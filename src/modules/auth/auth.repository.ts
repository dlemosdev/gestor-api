import { executar, obter } from '../../banco/conexao';
import { agoraIso } from '../../util/serializacao';
import { DesafioDoisFatoresLinha, SessaoAuthLinha, UsuarioAuthLinha } from './auth.types';

const TABELAS = {
  usuarios: 'TB_Usuarios',
  usuariosAuth: 'TB_Usuarios_Auth',
  sessoesAuth: 'TB_Sessoes_Auth',
  desafios2fa: 'TB_Desafios_2FA',
} as const;

export class AuthRepository {
  async buscarUsuarioPorEmail(emailNormalizado: string): Promise<UsuarioAuthLinha | null> {
    return obter<UsuarioAuthLinha>(
      `SELECT u.id, u.nome, u.email, u.iniciais, a.senha_hash, a.tentativas_falha, a.bloqueado_ate
       FROM ${TABELAS.usuarios} u
       JOIN ${TABELAS.usuariosAuth} a ON a.usuario_id = u.id
       WHERE LOWER(u.email) = ?`,
      [emailNormalizado],
    );
  }

  async buscarUsuarioPorId(usuarioId: string): Promise<UsuarioAuthLinha | null> {
    return obter<UsuarioAuthLinha>(
      `SELECT u.id, u.nome, u.email, u.iniciais, a.senha_hash, a.tentativas_falha, a.bloqueado_ate
       FROM ${TABELAS.usuarios} u
       JOIN ${TABELAS.usuariosAuth} a ON a.usuario_id = u.id
       WHERE u.id = ?`,
      [usuarioId],
    );
  }

  async incrementarTentativasFalha(usuarioId: string, proximaTentativa: number, bloqueadoAte: string | null): Promise<void> {
    await executar(
      `UPDATE ${TABELAS.usuariosAuth}
       SET tentativas_falha = ?, bloqueado_ate = ?, atualizado_em = ?
       WHERE usuario_id = ?`,
      [proximaTentativa, bloqueadoAte, agoraIso(), usuarioId],
    );
  }

  async resetarTentativasFalha(usuarioId: string): Promise<void> {
    await executar(
      `UPDATE ${TABELAS.usuariosAuth}
       SET tentativas_falha = 0, bloqueado_ate = NULL, ultimo_login_em = ?, atualizado_em = ?
       WHERE usuario_id = ?`,
      [agoraIso(), agoraIso(), usuarioId],
    );
  }

  async criarSessao(params: {
    id: string;
    usuarioId: string;
    tokenHash: string;
    expiraEm: string;
    ipOrigem: string;
    userAgent: string;
  }): Promise<void> {
    await executar(
      `INSERT INTO ${TABELAS.sessoesAuth} (id, usuario_id, token_hash, expira_em, revogado_em, ip_origem, user_agent, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        params.id,
        params.usuarioId,
        params.tokenHash,
        params.expiraEm,
        params.ipOrigem,
        params.userAgent,
        agoraIso(),
        agoraIso(),
      ],
    );
  }

  async buscarSessaoPorTokenHash(tokenHash: string): Promise<SessaoAuthLinha | null> {
    return obter<SessaoAuthLinha>(
      `SELECT id, usuario_id, token_hash, expira_em, revogado_em
       FROM ${TABELAS.sessoesAuth}
       WHERE token_hash = ?`,
      [tokenHash],
    );
  }

  async revogarSessaoPorId(sessaoId: string): Promise<void> {
    await executar(
      `UPDATE ${TABELAS.sessoesAuth} SET revogado_em = ?, atualizado_em = ? WHERE id = ?`,
      [agoraIso(), agoraIso(), sessaoId],
    );
  }

  async revogarSessaoPorTokenHash(tokenHash: string): Promise<void> {
    await executar(
      `UPDATE ${TABELAS.sessoesAuth}
       SET revogado_em = COALESCE(revogado_em, ?), atualizado_em = ?
       WHERE token_hash = ?`,
      [agoraIso(), agoraIso(), tokenHash],
    );
  }

  async criarDesafio(params: {
    id: string;
    usuarioId: string;
    codigoHash: string;
    expiraEm: string;
    ipOrigem: string;
    userAgent: string;
  }): Promise<void> {
    await executar(
      `INSERT INTO ${TABELAS.desafios2fa} (
        id, usuario_id, codigo_hash, tentativas_falha, expira_em, consumido_em, ip_origem, user_agent, criado_em, atualizado_em
      ) VALUES (?, ?, ?, 0, ?, NULL, ?, ?, ?, ?)`,
      [
        params.id,
        params.usuarioId,
        params.codigoHash,
        params.expiraEm,
        params.ipOrigem,
        params.userAgent,
        agoraIso(),
        agoraIso(),
      ],
    );
  }

  async buscarDesafio(desafioId: string, usuarioId: string): Promise<DesafioDoisFatoresLinha | null> {
    return obter<DesafioDoisFatoresLinha>(
      `SELECT id, usuario_id, codigo_hash, tentativas_falha, expira_em, consumido_em
       FROM ${TABELAS.desafios2fa}
       WHERE id = ? AND usuario_id = ?`,
      [desafioId, usuarioId],
    );
  }

  async atualizarTentativasDesafio(desafioId: string, tentativasFalha: number, consumidoEm: string | null): Promise<void> {
    await executar(
      `UPDATE ${TABELAS.desafios2fa}
       SET tentativas_falha = ?, consumido_em = COALESCE(consumido_em, ?), atualizado_em = ?
       WHERE id = ?`,
      [tentativasFalha, consumidoEm, agoraIso(), desafioId],
    );
  }

  async consumirDesafio(desafioId: string): Promise<void> {
    await executar(
      `UPDATE ${TABELAS.desafios2fa} SET consumido_em = ?, atualizado_em = ? WHERE id = ?`,
      [agoraIso(), agoraIso(), desafioId],
    );
  }
}

