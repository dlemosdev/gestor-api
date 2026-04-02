import { randomInt, randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { Request, Response, Router } from 'express';

import {
  gerarIdentificadorSessao,
  gerarTokenAcesso,
  gerarTokenDesafio,
  gerarTokenRefresh,
  hashToken,
  nomeCookieRefresh,
  verificarTokenDesafio,
  verificarTokenRefresh,
} from '../autenticacao/jwt';
import { executar, obter, transacao } from '../banco/conexao';
import { enviarCodigoSegundoFator } from '../notificacao/email';
import { ApiErro, responderProblema } from '../tipos/erros';
import { agoraIso } from '../util/serializacao';

interface UsuarioAuthLinha {
  id: string;
  nome: string;
  email: string;
  iniciais: string;
  senha_hash: string;
  tentativas_falha: number;
  bloqueado_ate: string | null;
}

interface SessaoAuthLinha {
  id: string;
  usuario_id: string;
  token_hash: string;
  expira_em: string;
  revogado_em: string | null;
}

interface DesafioDoisFatoresLinha {
  id: string;
  usuario_id: string;
  codigo_hash: string;
  tentativas_falha: number;
  expira_em: string;
  consumido_em: string | null;
}

interface LoginPayload {
  email: string;
  senha: string;
}

interface ValidarCodigoPayload {
  tokenDesafio: string;
  codigo: string;
}

interface UsuarioResposta {
  id: string;
  nome: string;
  email: string;
  iniciais: string;
}

const minutosBloqueioFalha = 15;
const limiteFalhas = 5;
const limiteFalhasDesafio = 5;
const validadeCodigoMinutos = 10;

function criarRateLimitHandler(detail: string) {
  return (req: Request, res: Response): void => {
    responderProblema(req, res, new ApiErro(detail, 429));
  };
}

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: criarRateLimitHandler('Muitas tentativas de login. Tente novamente em alguns minutos.'),
});

const limiteValidacaoCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: criarRateLimitHandler('Muitas tentativas de validacao. Tente novamente em alguns minutos.'),
});

export const roteadorAutenticacao = Router();

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function montarRespostaUsuario(usuario: UsuarioAuthLinha): UsuarioResposta {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    iniciais: usuario.iniciais,
  };
}

function obterIpRequisicao(req: Request): string {
  const encaminhado = req.headers['x-forwarded-for'];
  if (typeof encaminhado === 'string') {
    return encaminhado.split(',')[0]?.trim() ?? req.ip ?? 'desconhecido';
  }

  return req.ip ?? 'desconhecido';
}

function cookieSegura(): boolean {
  return process.env.NODE_ENV === 'production';
}

function definirCookieRefresh(res: Response, tokenRefresh: string): void {
  res.cookie(nomeCookieRefresh, tokenRefresh, {
    httpOnly: true,
    secure: cookieSegura(),
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function limparCookieRefresh(res: Response): void {
  res.clearCookie(nomeCookieRefresh, {
    httpOnly: true,
    secure: cookieSegura(),
    sameSite: 'strict',
    path: '/api/auth',
  });
}

function gerarCodigoSeisDigitos(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCodigoDesafio(desafioId: string, codigo: string): string {
  return hashToken(`${desafioId}:${codigo}`);
}

async function registrarNovaSessao(
  usuario: UsuarioAuthLinha,
  req: Request,
): Promise<{ tokenAcesso: string; tokenRefresh: string }> {
  const identificadorSessao = gerarIdentificadorSessao();
  const tokenRefresh = gerarTokenRefresh(usuario.id, usuario.email, identificadorSessao);
  const payloadRefresh = verificarTokenRefresh(tokenRefresh);

  if (!payloadRefresh.exp) {
    throw new ApiErro('Falha ao criar sessao.', 500);
  }

  await executar(
    `INSERT INTO sessoes_auth (id, usuario_id, token_hash, expira_em, revogado_em, ip_origem, user_agent, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    [
      identificadorSessao,
      usuario.id,
      hashToken(tokenRefresh),
      new Date(payloadRefresh.exp * 1000).toISOString(),
      obterIpRequisicao(req),
      String(req.headers['user-agent'] ?? '').slice(0, 255),
      agoraIso(),
      agoraIso(),
    ],
  );

  return {
    tokenAcesso: gerarTokenAcesso(usuario.id, usuario.email),
    tokenRefresh,
  };
}

async function buscarUsuarioPorEmail(email: string): Promise<UsuarioAuthLinha | null> {
  return obter<UsuarioAuthLinha>(
    `SELECT u.id, u.nome, u.email, u.iniciais, a.senha_hash, a.tentativas_falha, a.bloqueado_ate
     FROM usuarios u
     JOIN usuarios_auth a ON a.usuario_id = u.id
     WHERE LOWER(u.email) = ?`,
    [normalizarEmail(email)],
  );
}

async function buscarUsuarioPorId(usuarioId: string): Promise<UsuarioAuthLinha | null> {
  return obter<UsuarioAuthLinha>(
    `SELECT u.id, u.nome, u.email, u.iniciais, a.senha_hash, a.tentativas_falha, a.bloqueado_ate
     FROM usuarios u
     JOIN usuarios_auth a ON a.usuario_id = u.id
     WHERE u.id = ?`,
    [usuarioId],
  );
}

async function incrementarTentativasFalha(usuario: UsuarioAuthLinha): Promise<void> {
  const proximaTentativa = usuario.tentativas_falha + 1;
  const bloqueadoAte =
    proximaTentativa >= limiteFalhas
      ? new Date(Date.now() + minutosBloqueioFalha * 60 * 1000).toISOString()
      : null;

  await executar(
    `UPDATE usuarios_auth
     SET tentativas_falha = ?, bloqueado_ate = ?, atualizado_em = ?
     WHERE usuario_id = ?`,
    [proximaTentativa >= limiteFalhas ? 0 : proximaTentativa, bloqueadoAte, agoraIso(), usuario.id],
  );
}

async function resetarTentativasFalha(usuarioId: string): Promise<void> {
  await executar(
    `UPDATE usuarios_auth
     SET tentativas_falha = 0, bloqueado_ate = NULL, ultimo_login_em = ?, atualizado_em = ?
     WHERE usuario_id = ?`,
    [agoraIso(), agoraIso(), usuarioId],
  );
}

async function criarDesafioDoisFatores(usuario: UsuarioAuthLinha, req: Request): Promise<{ tokenDesafio: string }> {
  const desafioId = randomUUID();
  const codigo = gerarCodigoSeisDigitos();
  const expiraEm = new Date(Date.now() + validadeCodigoMinutos * 60 * 1000).toISOString();

  await executar(
    `INSERT INTO desafios_2fa (
      id, usuario_id, codigo_hash, tentativas_falha, expira_em, consumido_em, ip_origem, user_agent, criado_em, atualizado_em
    ) VALUES (?, ?, ?, 0, ?, NULL, ?, ?, ?, ?)`,
    [
      desafioId,
      usuario.id,
      hashCodigoDesafio(desafioId, codigo),
      expiraEm,
      obterIpRequisicao(req),
      String(req.headers['user-agent'] ?? '').slice(0, 255),
      agoraIso(),
      agoraIso(),
    ],
  );

  await enviarCodigoSegundoFator(usuario.email, usuario.nome, codigo, validadeCodigoMinutos);

  return {
    tokenDesafio: gerarTokenDesafio(usuario.id, usuario.email, desafioId),
  };
}

roteadorAutenticacao.post('/login', limiteLogin, async (req, res, next) => {
  try {
    const dados = req.body as Partial<LoginPayload>;
    const email = String(dados.email ?? '').trim();
    const senha = String(dados.senha ?? '');

    if (!email || !senha) {
      throw new ApiErro('Credenciais invalidas.', 401);
    }

    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario) {
      throw new ApiErro('Credenciais invalidas.', 401);
    }

    if (usuario.bloqueado_ate && new Date(usuario.bloqueado_ate).getTime() > Date.now()) {
      throw new ApiErro('Conta temporariamente bloqueada. Tente novamente mais tarde.', 423);
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      await incrementarTentativasFalha(usuario);
      throw new ApiErro('Credenciais invalidas.', 401);
    }

    const desafio = await criarDesafioDoisFatores(usuario, req);

    res.json({
      requerSegundoFator: true,
      tokenDesafio: desafio.tokenDesafio,
    });
  } catch (erro) {
    next(erro);
  }
});

roteadorAutenticacao.post('/2fa/validar', limiteValidacaoCodigo, async (req, res, next) => {
  try {
    const dados = req.body as Partial<ValidarCodigoPayload>;
    const tokenDesafio = String(dados.tokenDesafio ?? '');
    const codigo = String(dados.codigo ?? '').replace(/\D/g, '');

    if (!tokenDesafio || codigo.length !== 6) {
      throw new ApiErro('Codigo invalido.', 400);
    }

    const payload = verificarTokenDesafio(tokenDesafio);
    if (payload.tipo !== 'desafio' || !payload.usuarioId || !payload.email || !payload.desafioId) {
      throw new ApiErro('Desafio de autenticacao invalido.', 401);
    }

    const desafio = await obter<DesafioDoisFatoresLinha>(
      `SELECT id, usuario_id, codigo_hash, tentativas_falha, expira_em, consumido_em
       FROM desafios_2fa
       WHERE id = ? AND usuario_id = ?`,
      [payload.desafioId, payload.usuarioId],
    );

    if (!desafio || desafio.consumido_em || new Date(desafio.expira_em).getTime() <= Date.now()) {
      throw new ApiErro('Codigo expirado ou invalido.', 401);
    }

    const hashInformado = hashCodigoDesafio(desafio.id, codigo);
    if (hashInformado !== desafio.codigo_hash) {
      const proximaTentativa = desafio.tentativas_falha + 1;
      const consumidoEm = proximaTentativa >= limiteFalhasDesafio ? agoraIso() : null;

      await executar(
        `UPDATE desafios_2fa
         SET tentativas_falha = ?, consumido_em = COALESCE(consumido_em, ?), atualizado_em = ?
         WHERE id = ?`,
        [proximaTentativa, consumidoEm, agoraIso(), desafio.id],
      );

      throw new ApiErro('Codigo invalido.', 401);
    }

    const usuario = await buscarUsuarioPorId(payload.usuarioId);
    if (!usuario || normalizarEmail(usuario.email) !== normalizarEmail(payload.email)) {
      throw new ApiErro('Usuario invalido para autenticacao.', 401);
    }

    const sessao = await transacao(async () => {
      await executar('UPDATE desafios_2fa SET consumido_em = ?, atualizado_em = ? WHERE id = ?', [agoraIso(), agoraIso(), desafio.id]);
      await resetarTentativasFalha(usuario.id);
      return registrarNovaSessao(usuario, req);
    });

    definirCookieRefresh(res, sessao.tokenRefresh);

    res.json({
      tokenAcesso: sessao.tokenAcesso,
      usuario: montarRespostaUsuario(usuario),
    });
  } catch (erro) {
    next(erro);
  }
});

roteadorAutenticacao.post('/refresh', async (req, res, next) => {
  try {
    const tokenRefreshAtual = req.cookies?.[nomeCookieRefresh] as string | undefined;
    if (!tokenRefreshAtual) {
      throw new ApiErro('Sessao invalida.', 401);
    }

    const payload = verificarTokenRefresh(tokenRefreshAtual);
    if (payload.tipo !== 'refresh' || !payload.usuarioId || !payload.email) {
      throw new ApiErro('Sessao invalida.', 401);
    }

    const hashAtual = hashToken(tokenRefreshAtual);
    const sessao = await obter<SessaoAuthLinha>(
      `SELECT id, usuario_id, token_hash, expira_em, revogado_em
       FROM sessoes_auth
       WHERE token_hash = ?`,
      [hashAtual],
    );

    if (!sessao || sessao.revogado_em || new Date(sessao.expira_em).getTime() <= Date.now()) {
      throw new ApiErro('Sessao invalida.', 401);
    }

    const usuario = await buscarUsuarioPorId(payload.usuarioId);
    if (!usuario || normalizarEmail(usuario.email) !== normalizarEmail(payload.email)) {
      throw new ApiErro('Sessao invalida.', 401);
    }

    const novaSessao = await transacao(async () => {
      await executar('UPDATE sessoes_auth SET revogado_em = ?, atualizado_em = ? WHERE id = ?', [
        agoraIso(),
        agoraIso(),
        sessao.id,
      ]);
      return registrarNovaSessao(usuario, req);
    });

    definirCookieRefresh(res, novaSessao.tokenRefresh);
    res.json({
      tokenAcesso: novaSessao.tokenAcesso,
      usuario: montarRespostaUsuario(usuario),
    });
  } catch (erro) {
    limparCookieRefresh(res);
    next(erro);
  }
});

roteadorAutenticacao.post('/logout', async (req, res, next) => {
  try {
    const tokenRefreshAtual = req.cookies?.[nomeCookieRefresh] as string | undefined;

    if (tokenRefreshAtual) {
      await executar(
        `UPDATE sessoes_auth
         SET revogado_em = COALESCE(revogado_em, ?), atualizado_em = ?
         WHERE token_hash = ?`,
        [agoraIso(), agoraIso(), hashToken(tokenRefreshAtual)],
      );
    }

    limparCookieRefresh(res);
    res.status(204).send();
  } catch (erro) {
    next(erro);
  }
});
