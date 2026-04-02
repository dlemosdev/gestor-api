import { NextFunction, Request, Response } from 'express';

import { ApiErro } from '../tipos/erros';
import { verificarTokenAcesso } from './jwt';

export function autenticarRequisicao(req: Request, _res: Response, next: NextFunction): void {
  const cabecalhoAutorizacao = req.headers.authorization;

  if (!cabecalhoAutorizacao?.startsWith('Bearer ')) {
    throw new ApiErro('Não autorizado.', 401);
  }

  const token = cabecalhoAutorizacao.slice('Bearer '.length).trim();
  const payload = verificarTokenAcesso(token);

  if (payload.tipo !== 'acesso' || !payload.usuarioId || !payload.email) {
    throw new ApiErro('Não autorizado.', 401);
  }

  req.autenticacao = {
    usuarioId: payload.usuarioId,
    email: payload.email,
  };

  next();
}
