import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { autenticarRequisicao } from './autenticacao/middleware-autenticacao';
import { verificarSaudeBanco } from './banco/conexao';
import { appConfig } from './config/env';
import { criarContainer } from './container';
import { errorHandler } from './middleware/error-handler';
import { middlewareLogRequisicao } from './middleware/log-requisicao';
import { criarRoteadorAutenticacao } from './rotas/autenticacao';
import { criarRoteadorApi } from './rotas/api';
import { ApiErro } from './tipos/erros';

export function criarApp() {
  const app = express();
  const container = criarContainer();
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(
    cors({
      origin: appConfig.origemFrontend,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(middlewareLogRequisicao);
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const bancoOk = await verificarSaudeBanco();

    res.status(bancoOk ? 200 : 503).json({
      status: bancoOk ? 'ok' : 'degradado',
      servico: 'gestor-api',
      dependencias: {
        banco: bancoOk ? 'ok' : 'erro',
      },
    });
  });

  app.use('/api/auth', criarRoteadorAutenticacao(container.controllers.auth));
  app.use('/api/auth', (_req, _res, next) => {
    next(new ApiErro('Recurso nao encontrado.', 404));
  });
  app.use(
    '/api',
    autenticarRequisicao,
    criarRoteadorApi({
      projetoController: container.controllers.projetos,
      raiaController: container.controllers.raias,
      atividadeController: container.controllers.atividades,
    }),
  );

  app.use('/api', (_req, _res, next) => {
    next(new ApiErro('Recurso nao encontrado.', 404));
  });

  app.use(errorHandler);

  return app;
}
