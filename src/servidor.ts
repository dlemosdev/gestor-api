import { Server } from 'node:http';

import { criarApp } from './app';
import { fecharConexao } from './banco/conexao';
import { inicializarBanco } from './banco/inicializar-banco';
import { appConfig } from './config/env';
import { logger } from './infra/logger';

const app = criarApp();
let servidorHttp: Server | null = null;
let desligando = false;

async function iniciarServidor(): Promise<void> {
  await inicializarBanco();

  servidorHttp = app.listen(appConfig.portaApi, () => {
    logger.info({
      msg: 'api iniciada',
      porta: appConfig.portaApi,
      origemFrontend: appConfig.origemFrontend,
    });
  });
}

async function encerrarAplicacao(sinal: NodeJS.Signals): Promise<void> {
  if (desligando) {
    return;
  }

  desligando = true;
  logger.info({ msg: 'encerrando aplicacao', sinal });

  try {
    if (servidorHttp) {
      await new Promise<void>((resolver, rejeitar) => {
        servidorHttp?.close((erro) => {
          if (erro) {
            rejeitar(erro);
            return;
          }

          resolver();
        });
      });
    }

    await fecharConexao();

    logger.info({ msg: 'aplicacao encerrada com sucesso' });
    process.exit(0);
  } catch (erro) {
    logger.error({
      msg: 'falha ao encerrar aplicacao',
      detalhe: erro instanceof Error ? erro.message : 'erro desconhecido',
      stack: erro instanceof Error ? erro.stack : undefined,
    });
    process.exit(1);
  }
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

process.on('SIGINT', () => {
  void encerrarAplicacao('SIGINT');
});

process.on('SIGTERM', () => {
  void encerrarAplicacao('SIGTERM');
});

