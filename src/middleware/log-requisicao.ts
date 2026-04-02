import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

import { logger } from '../infra/logger';

function nivelPorStatus(statusCode: number): 'info' | 'warn' | 'error' {
  if (statusCode >= 500) {
    return 'error';
  }

  if (statusCode >= 400) {
    return 'warn';
  }

  return 'info';
}

export function middlewareLogRequisicao(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') || randomUUID();
  const inicio = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const duracaoNs = process.hrtime.bigint() - inicio;
    const duracaoMs = Number(duracaoNs) / 1_000_000;
    const nivel = nivelPorStatus(res.statusCode);

    logger[nivel]({
      msg: 'requisicao finalizada',
      requestId,
      metodo: req.method,
      rota: req.originalUrl,
      statusCode: res.statusCode,
      duracaoMs: Number(duracaoMs.toFixed(2)),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
}

