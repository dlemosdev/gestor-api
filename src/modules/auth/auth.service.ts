import { randomInt, randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import {
  gerarIdentificadorSessao,
  gerarTokenAcesso,
  gerarTokenDesafio,
  gerarTokenRefresh,
  hashToken,
  verificarTokenDesafio,
  verificarTokenRefresh,
} from '../../autenticacao/jwt';
import { appConfig } from '../../config/env';
import { executar, transacao } from '../../banco/conexao';
import { ApiErro } from '../../tipos/erros';
import { AuthRepository } from './auth.repository';
import {
  AuthRequestMeta,
  AuthTokens,
  LoginPayload,
  ResultadoAutenticado,
  ResultadoLogin,
  UsuarioAuthLinha,
  UsuarioResposta,
  ValidarCodigoPayload,
} from './auth.types';

interface EmailGateway {
  enviarCodigoSegundoFator(email: string, nome: string, codigo: string, validadeMinutos: number): Promise<void>;
}

type TransactionRunner = <T>(callback: () => Promise<T>) => Promise<T>;

const minutosBloqueioFalha = 15;
const limiteFalhas = 5;
const limiteFalhasDesafio = 5;
const validadeCodigoMinutos = 10;

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly emailGateway: EmailGateway,
    private readonly runInTransaction: TransactionRunner = transacao,
  ) {}

  async login(payload: LoginPayload, meta: AuthRequestMeta): Promise<ResultadoLogin> {
    const usuario = await this.authRepository.buscarUsuarioPorEmail(this.normalizarEmail(payload.email));
    if (!usuario) {
      throw new ApiErro('Credenciais invalidas.', 401);
    }

    this.validarBloqueio(usuario);

    const senhaValida = await bcrypt.compare(payload.senha, usuario.senha_hash);
    if (!senhaValida) {
      await this.registrarFalhaLogin(usuario);
      throw new ApiErro('Credenciais invalidas.', 401);
    }

    if (!appConfig.auth2faEnabled) {
      const tokens = await this.runInTransaction(async () => {
        await this.authRepository.resetarTentativasFalha(usuario.id);
        return this.criarSessao(usuario, meta);
      });

      return {
        requerSegundoFator: false,
        tokenAcesso: tokens.tokenAcesso,
        tokenRefresh: tokens.tokenRefresh,
        usuario: this.montarRespostaUsuario(usuario),
      };
    }

    const desafio = await this.criarDesafioDoisFatores(usuario, meta);
    return {
      requerSegundoFator: true,
      tokenDesafio: desafio.tokenDesafio,
    };
  }

  async validarCodigo(payload: ValidarCodigoPayload, meta: AuthRequestMeta): Promise<ResultadoAutenticado> {
    const tokenDesafio = payload.tokenDesafio;
    const codigo = payload.codigo.replace(/\D/g, '');

    if (codigo.length !== 6) {
      throw new ApiErro('Codigo invalido.', 400);
    }

    const dadosDesafio = verificarTokenDesafio(tokenDesafio);
    if (dadosDesafio.tipo !== 'desafio' || !dadosDesafio.usuarioId || !dadosDesafio.email || !dadosDesafio.desafioId) {
      throw new ApiErro('Desafio de autenticacao invalido.', 401);
    }

    const desafio = await this.authRepository.buscarDesafio(dadosDesafio.desafioId, dadosDesafio.usuarioId);
    if (!desafio || desafio.consumido_em || new Date(desafio.expira_em).getTime() <= Date.now()) {
      throw new ApiErro('Codigo expirado ou invalido.', 401);
    }

    const hashInformado = this.hashCodigoDesafio(desafio.id, codigo);
    if (hashInformado !== desafio.codigo_hash) {
      const proximaTentativa = desafio.tentativas_falha + 1;
      const consumidoEm = proximaTentativa >= limiteFalhasDesafio ? new Date().toISOString() : null;
      await this.authRepository.atualizarTentativasDesafio(desafio.id, proximaTentativa, consumidoEm);
      throw new ApiErro('Codigo invalido.', 401);
    }

    const usuario = await this.authRepository.buscarUsuarioPorId(dadosDesafio.usuarioId);
    if (!usuario || this.normalizarEmail(usuario.email) !== this.normalizarEmail(dadosDesafio.email)) {
      throw new ApiErro('Usuario invalido para autenticacao.', 401);
    }

    const tokens = await this.runInTransaction(async () => {
      await this.authRepository.consumirDesafio(desafio.id);
      await this.authRepository.resetarTentativasFalha(usuario.id);
      return this.criarSessao(usuario, meta);
    });

    return {
      tokenAcesso: tokens.tokenAcesso,
      tokenRefresh: tokens.tokenRefresh,
      usuario: this.montarRespostaUsuario(usuario),
    };
  }

  async refresh(tokenRefreshAtual: string, meta: AuthRequestMeta): Promise<ResultadoAutenticado> {
    const payload = verificarTokenRefresh(tokenRefreshAtual);
    if (payload.tipo !== 'refresh' || !payload.usuarioId || !payload.email) {
      throw new ApiErro('Sessao invalida.', 401);
    }

    const hashAtual = hashToken(tokenRefreshAtual);
    const sessao = await this.authRepository.buscarSessaoPorTokenHash(hashAtual);
    if (!sessao || sessao.revogado_em || new Date(sessao.expira_em).getTime() <= Date.now()) {
      throw new ApiErro('Sessao invalida.', 401);
    }

    const usuario = await this.authRepository.buscarUsuarioPorId(payload.usuarioId);
    if (!usuario || this.normalizarEmail(usuario.email) !== this.normalizarEmail(payload.email)) {
      throw new ApiErro('Sessao invalida.', 401);
    }

    const tokens = await this.runInTransaction(async () => {
      await this.authRepository.revogarSessaoPorId(sessao.id);
      return this.criarSessao(usuario, meta);
    });

    return {
      tokenAcesso: tokens.tokenAcesso,
      tokenRefresh: tokens.tokenRefresh,
      usuario: this.montarRespostaUsuario(usuario),
    };
  }

  async logout(tokenRefreshAtual?: string): Promise<void> {
    if (!tokenRefreshAtual) {
      return;
    }

    await this.authRepository.revogarSessaoPorTokenHash(hashToken(tokenRefreshAtual));
  }

  private normalizarEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private montarRespostaUsuario(usuario: UsuarioAuthLinha): UsuarioResposta {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      iniciais: usuario.iniciais,
    };
  }

  private validarBloqueio(usuario: UsuarioAuthLinha): void {
    if (usuario.bloqueado_ate && new Date(usuario.bloqueado_ate).getTime() > Date.now()) {
      throw new ApiErro('Conta temporariamente bloqueada. Tente novamente mais tarde.', 423);
    }
  }

  private async registrarFalhaLogin(usuario: UsuarioAuthLinha): Promise<void> {
    const proximaTentativa = usuario.tentativas_falha + 1;
    const bloqueadoAte =
      proximaTentativa >= limiteFalhas
        ? new Date(Date.now() + minutosBloqueioFalha * 60 * 1000).toISOString()
        : null;

    await this.authRepository.incrementarTentativasFalha(
      usuario.id,
      proximaTentativa >= limiteFalhas ? 0 : proximaTentativa,
      bloqueadoAte,
    );
  }

  private async criarSessao(usuario: UsuarioAuthLinha, meta: AuthRequestMeta): Promise<AuthTokens> {
    const identificadorSessao = gerarIdentificadorSessao();
    const tokenRefresh = gerarTokenRefresh(usuario.id, usuario.email, identificadorSessao);
    const payloadRefresh = verificarTokenRefresh(tokenRefresh);

    if (!payloadRefresh.exp) {
      throw new ApiErro('Falha ao criar sessao.', 500);
    }

    await this.authRepository.criarSessao({
      id: identificadorSessao,
      usuarioId: usuario.id,
      tokenHash: hashToken(tokenRefresh),
      expiraEm: new Date(payloadRefresh.exp * 1000).toISOString(),
      ipOrigem: meta.ipOrigem,
      userAgent: meta.userAgent.slice(0, 255),
    });

    return {
      tokenAcesso: gerarTokenAcesso(usuario.id, usuario.email),
      tokenRefresh,
    };
  }

  private async criarDesafioDoisFatores(usuario: UsuarioAuthLinha, meta: AuthRequestMeta): Promise<{ tokenDesafio: string }> {
    const desafioId = randomUUID();
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiraEm = new Date(Date.now() + validadeCodigoMinutos * 60 * 1000).toISOString();

    await this.authRepository.criarDesafio({
      id: desafioId,
      usuarioId: usuario.id,
      codigoHash: this.hashCodigoDesafio(desafioId, codigo),
      expiraEm,
      ipOrigem: meta.ipOrigem,
      userAgent: meta.userAgent.slice(0, 255),
    });

    await this.emailGateway.enviarCodigoSegundoFator(usuario.email, usuario.nome, codigo, validadeCodigoMinutos);

    return {
      tokenDesafio: gerarTokenDesafio(usuario.id, usuario.email, desafioId),
    };
  }

  private hashCodigoDesafio(desafioId: string, codigo: string): string {
    return hashToken(`${desafioId}:${codigo}`);
  }
}
