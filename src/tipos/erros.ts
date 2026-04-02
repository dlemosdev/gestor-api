import { Request, Response } from 'express';

export interface ProblemaDetalhes {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [chave: string]: unknown;
}

export class ApiErro extends Error {
  readonly statusCode: number;
  readonly type: string;
  readonly title?: string;
  readonly extras?: Record<string, unknown>;

  constructor(
    detail: string,
    statusCode = 400,
    opcoes?: {
      type?: string;
      title?: string;
      extras?: Record<string, unknown>;
    },
  ) {
    super(detail);
    this.statusCode = statusCode;
    this.type = opcoes?.type ?? 'about:blank';
    this.title = opcoes?.title;
    this.extras = opcoes?.extras;
  }
}

export function tituloPadraoProblema(statusCode: number): string {
  const titulos: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Content',
    423: 'Locked',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
  };

  return titulos[statusCode] ?? 'Error';
}

export function construirProblema(req: Request, erro: ApiErro): ProblemaDetalhes {
  const problema: ProblemaDetalhes = {
    type: erro.type,
    title: erro.title ?? tituloPadraoProblema(erro.statusCode),
    status: erro.statusCode,
    detail: erro.message,
    instance: req.originalUrl,
  };

  if (erro.extras) {
    Object.assign(problema, erro.extras);
  }

  return problema;
}

export function responderProblema(req: Request, res: Response, erro: ApiErro): void {
  res.status(erro.statusCode).type('application/problem+json').json(construirProblema(req, erro));
}
