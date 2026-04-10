import { NextFunction, Request, Response } from 'express';
import { z, ZodError, ZodType } from 'zod';

import { AppError, ValidationError } from '../tipos/erros';

type Validador<T> = ZodType<T> | ((valor: unknown) => T);

interface EsquemaValidacao {
  body?: Validador<unknown>;
  params?: Validador<unknown>;
  query?: Validador<unknown>;
}

function formatarErroZod(erro: ZodError): ValidationError {
  const arvore = z.treeifyError(erro);
  const errors = erro.issues.map((issue) => ({
    campo: issue.path.join('.') || undefined,
    mensagem: issue.message,
  }));

  return new ValidationError('Falha de validacao.', {
    ...arvore,
    errors,
  } as never);
}

function normalizarErroValidacao(erro: unknown): AppError {
  if (erro instanceof ValidationError) {
    return erro;
  }

  if (erro instanceof ZodError) {
    return formatarErroZod(erro);
  }

  if (erro instanceof AppError) {
    return erro;
  }

  if (erro instanceof Error) {
    return new ValidationError('Falha de validacao.', [{ mensagem: erro.message }]);
  }

  return new ValidationError('Falha de validacao.');
}

function aplicarValidador<T>(validador: Validador<T>, valor: unknown): T {
  if (typeof (validador as ZodType<T>).safeParse === 'function') {
    return (validador as ZodType<T>).parse(valor);
  }

  return (validador as (valor: unknown) => T)(valor);
}

export function validate(esquema: EsquemaValidacao) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (esquema.body) {
        req.body = aplicarValidador(esquema.body, req.body);
      }

      if (esquema.params) {
        req.params = aplicarValidador(esquema.params, req.params) as Request['params'];
      }

      if (esquema.query) {
        req.query = aplicarValidador(esquema.query, req.query) as Request['query'];
      }

      next();
    } catch (erro) {
      next(normalizarErroValidacao(erro));
    }
  };
}

