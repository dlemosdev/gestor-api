import { NextFunction, Request, Response } from 'express';

import { logger } from '../infra/logger';
import { ApiErro, AppError, responderProblema } from '../tipos/erros';

export function errorHandler(erro: Error, req: Request, res: Response, _next: NextFunction) {
  const contextoErro = {
    requestId: req.requestId,
    metodo: req.method,
    rota: req.originalUrl,
  };

  if (erro instanceof AppError) {
    const nivel = erro.statusCode >= 500 ? 'error' : 'warn';
    logger[nivel]({
      msg: 'erro de aplicacao',
      ...contextoErro,
      statusCode: erro.statusCode,
      tipo: erro.type,
      detalhe: erro.message,
      extras: erro.extras,
      stack: erro.statusCode >= 500 ? erro.stack : undefined,
    });
    responderProblema(req, res, erro);
    return;
  }

  const erroJsonInvalido =
    erro instanceof SyntaxError &&
    'type' in erro &&
    (erro as SyntaxError & { type?: string }).type === 'entity.parse.failed';

  if (erroJsonInvalido) {
    const problemaJson = new ApiErro('JSON inválido na requisição.', 400);
    logger.warn({
      msg: 'json invalido na requisicao',
      ...contextoErro,
      detalhe: erro.message,
    });
    responderProblema(req, res, problemaJson);
    return;
  }

  logger.error({
    msg: 'erro nao tratado',
    ...contextoErro,
    detalhe: erro.message,
    stack: erro.stack,
  });

  responderProblema(req, res, new ApiErro('Erro interno do servidor.', 500));
}

