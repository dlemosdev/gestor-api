import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';

import { autenticarRequisicao } from './autenticacao/middleware-autenticacao';
import { inicializarBanco } from './banco/inicializar-banco';
import { roteadorAutenticacao } from './rotas/autenticacao';
import { roteador } from './rotas/api';
import { ApiErro, responderProblema } from './tipos/erros';

const porta = Number(process.env.PORTA_API || 3333);
const origemFrontend = process.env.ORIGEM_FRONTEND || 'http://localhost:4200';

const app = express();

app.use(
  cors({
    origin: origemFrontend,
    credentials: true,
  }),
);
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
  if (erro instanceof ApiErro) {
    responderProblema(req, res, erro);
    return;
  }

  const erroInterno = new ApiErro('Erro interno do servidor.', 500);
  responderProblema(req, res, erroInterno);
});

async function iniciarServidor(): Promise<void> {
  await inicializarBanco();

  app.listen(porta, () => {
    // eslint-disable-next-line no-console
    console.log(`Gestor API disponivel em http://localhost:${porta}`);
  });
}

iniciarServidor().catch((erro) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao iniciar API:', erro);
  process.exit(1);
});
