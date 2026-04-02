import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';

import { autenticarRequisicao } from './autenticacao/middleware-autenticacao';
import { inicializarBanco } from './banco/inicializar-banco';
import { logger } from './infra/logger';
import { middlewareLogRequisicao } from './middleware/log-requisicao';
import { roteadorAutenticacao } from './rotas/autenticacao';
import { roteador } from './rotas/api';
import { ApiErro, responderProblema } from './tipos/erros';

const porta = Number(process.env.PORTA_API || 3333);
const origemFrontend = process.env.ORIGEM_FRONTEND || 'http://localhost:4200';

const app = express();
app.disable('x-powered-by');

app.use(
  cors({
    origin: origemFrontend,
    credentials: true,
  }),
);
app.use(middlewareLogRequisicao);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', servico: 'gestor-api' });
});

app.use('/api/auth', roteadorAutenticacao);
app.use('/api/auth', (req, _res, next) => {
  next(new ApiErro('Recurso nao encontrado.', 404));
});
app.use('/api', autenticarRequisicao, roteador);

app.use('/api', (req, _res, next) => {
  next(new ApiErro('Recurso nao encontrado.', 404));
});

app.use((erro: Error, req: Request, res: Response, _next: NextFunction) => {
  const contextoErro = {
    requestId: req.requestId,
    metodo: req.method,
    rota: req.originalUrl,
  };

  if (erro instanceof ApiErro) {
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

  logger.error({
    msg: 'erro nao tratado',
    ...contextoErro,
    detalhe: erro.message,
    stack: erro.stack,
  });

  const erroInterno = new ApiErro('Erro interno do servidor.', 500);
  responderProblema(req, res, erroInterno);
});

async function iniciarServidor(): Promise<void> {
  await inicializarBanco();

  app.listen(porta, () => {
    logger.info({
      msg: 'api iniciada',
      porta,
      origemFrontend,
    });
  });
}

iniciarServidor().catch((erro) => {
  logger.fatal({
    msg: 'falha ao iniciar api',
    detalhe: erro instanceof Error ? erro.message : 'erro desconhecido',
    stack: erro instanceof Error ? erro.stack : undefined,
  });
  process.exit(1);
});

process.on('unhandledRejection', (motivo) => {
  logger.error({
    msg: 'promessa rejeitada sem tratamento',
    detalhe: motivo instanceof Error ? motivo.message : String(motivo),
    stack: motivo instanceof Error ? motivo.stack : undefined,
  });
});

process.on('uncaughtException', (erro) => {
  logger.fatal({
    msg: 'excecao nao capturada',
    detalhe: erro.message,
    stack: erro.stack,
  });
  process.exit(1);
});

