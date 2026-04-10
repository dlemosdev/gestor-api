export interface UsuarioAuthLinha {
  id: string;
  nome: string;
  email: string;
  iniciais: string;
  senha_hash: string;
  tentativas_falha: number;
  bloqueado_ate: string | null;
}

export interface SessaoAuthLinha {
  id: string;
  usuario_id: string;
  token_hash: string;
  expira_em: string;
  revogado_em: string | null;
}

export interface DesafioDoisFatoresLinha {
  id: string;
  usuario_id: string;
  codigo_hash: string;
  tentativas_falha: number;
  expira_em: string;
  consumido_em: string | null;
}

export interface LoginPayload {
  email: string;
  senha: string;
}

export interface ValidarCodigoPayload {
  tokenDesafio: string;
  codigo: string;
}

export interface UsuarioResposta {
  id: string;
  nome: string;
  email: string;
  iniciais: string;
}

export interface AuthRequestMeta {
  ipOrigem: string;
  userAgent: string;
}

export interface AuthTokens {
  tokenAcesso: string;
  tokenRefresh: string;
}

export type ResultadoLogin =
  | {
      requerSegundoFator: true;
      tokenDesafio: string;
    }
  | {
      requerSegundoFator: false;
      tokenAcesso: string;
      tokenRefresh: string;
      usuario: UsuarioResposta;
    };

export interface ResultadoAutenticado {
  tokenAcesso: string;
  tokenRefresh: string;
  usuario: UsuarioResposta;
}

