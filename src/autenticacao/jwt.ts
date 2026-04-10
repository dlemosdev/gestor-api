import crypto from 'node:crypto';

import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

import { appConfig } from '../config/env';
import { ApiErro } from '../tipos/erros';

const segredoAcesso = appConfig.jwt.segredoAcesso;
const segredoRefresh = appConfig.jwt.segredoRefresh;
const segredoDesafio = appConfig.jwt.segredoDesafio;

const duracaoTokenAcesso = appConfig.jwt.duracaoAcesso;
const duracaoTokenRefresh = appConfig.jwt.duracaoRefresh;
const duracaoTokenDesafio = appConfig.jwt.duracaoDesafio;

export const nomeCookieRefresh = 'gestor_refresh_token';

export interface PayloadAutenticacao extends JwtPayload {
  usuarioId: string;
  email: string;
  tipo: 'acesso' | 'refresh' | 'desafio';
  desafioId?: string;
  jti?: string;
}

export function gerarTokenAcesso(usuarioId: string, email: string): string {
  const opcoes: SignOptions = {
    subject: usuarioId,
    expiresIn: duracaoTokenAcesso as SignOptions['expiresIn'],
    issuer: 'gestor-api',
    audience: 'gestor-web',
  };

  return jwt.sign({ usuarioId, email, tipo: 'acesso' }, segredoAcesso, opcoes);
}

export function gerarTokenRefresh(usuarioId: string, email: string, jti: string): string {
  const opcoes: SignOptions = {
    subject: usuarioId,
    expiresIn: duracaoTokenRefresh as SignOptions['expiresIn'],
    issuer: 'gestor-api',
    audience: 'gestor-web',
    jwtid: jti,
  };

  return jwt.sign({ usuarioId, email, tipo: 'refresh' }, segredoRefresh, opcoes);
}

export function gerarTokenDesafio(usuarioId: string, email: string, desafioId: string): string {
  const opcoes: SignOptions = {
    subject: usuarioId,
    expiresIn: duracaoTokenDesafio as SignOptions['expiresIn'],
    issuer: 'gestor-api',
    audience: 'gestor-web',
  };

  return jwt.sign({ usuarioId, email, tipo: 'desafio', desafioId }, segredoDesafio, opcoes);
}

export function verificarTokenAcesso(token: string): PayloadAutenticacao {
  try {
    return jwt.verify(token, segredoAcesso, { issuer: 'gestor-api', audience: 'gestor-web' }) as PayloadAutenticacao;
  } catch {
    throw new ApiErro('Nao autorizado.', 401);
  }
}

export function verificarTokenRefresh(token: string): PayloadAutenticacao {
  try {
    return jwt.verify(token, segredoRefresh, { issuer: 'gestor-api', audience: 'gestor-web' }) as PayloadAutenticacao;
  } catch {
    throw new ApiErro('Sessao invalida.', 401);
  }
}

export function verificarTokenDesafio(token: string): PayloadAutenticacao {
  try {
    return jwt.verify(token, segredoDesafio, { issuer: 'gestor-api', audience: 'gestor-web' }) as PayloadAutenticacao;
  } catch {
    throw new ApiErro('Desafio de autenticacao invalido.', 401);
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function gerarIdentificadorSessao(): string {
  return crypto.randomUUID();
}
