import { Writable } from 'node:stream';

import pino from 'pino';

const ambiente = process.env.NODE_ENV ?? 'development';

function normalizarValor(valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') {
    return '';
  }

  if (typeof valor === 'string') {
    return valor;
  }

  return JSON.stringify(valor, null, 2);
}

function criarDestinoLegivel() {
  return new Writable({
    write(chunk, _encoding, callback) {
      try {
        const linha = chunk.toString().trim();

        if (!linha) {
          callback();
          return;
        }

        const registro = JSON.parse(linha) as Record<string, unknown>;
        const nivel = typeof registro.level === 'number' ? pino.levels.labels[registro.level] ?? 'info' : 'info';
        const cabecalho = [
          `[${normalizarValor(registro.time) || new Date().toISOString()}]`,
          nivel.toUpperCase(),
          normalizarValor(registro.name || registro.servico || 'gestor-api'),
          normalizarValor(registro.msg),
        ]
          .filter(Boolean)
          .join(' ');

        const chavesIgnoradas = new Set([
          'level',
          'time',
          'pid',
          'hostname',
          'name',
          'servico',
          'ambiente',
          'msg',
          'stack',
        ]);

        const linhas = [cabecalho];

        if (registro.requestId) {
          linhas.push(`requestId: ${normalizarValor(registro.requestId)}`);
        }

        const metodo = normalizarValor(registro.metodo);
        const rota = normalizarValor(registro.rota);
        if (metodo || rota) {
          linhas.push(`requisicao: ${[metodo, rota].filter(Boolean).join(' ')}`);
        }

        Object.entries(registro).forEach(([chave, valor]) => {
          if (chavesIgnoradas.has(chave) || valor === undefined || valor === null || valor === '') {
            return;
          }

          const texto = normalizarValor(valor);
          if (!texto) {
            return;
          }

          if (texto.includes('\n')) {
            linhas.push(`${chave}:`);
            linhas.push(
              ...texto.split('\n').map((linhaAtual) => `  ${linhaAtual}`),
            );
            return;
          }

          linhas.push(`${chave}: ${texto}`);
        });

        const stack = normalizarValor(registro.stack);
        if (stack) {
          linhas.push('stacktrace:');
          linhas.push(...stack.split('\n').map((linhaAtual) => `  ${linhaAtual}`));
        }

        const saida = `${linhas.join('\n')}\n\n`;
        const destino = nivel === 'error' || nivel === 'fatal' || nivel === 'warn' ? process.stderr : process.stdout;
        destino.write(saida);
        callback();
      } catch (erro) {
        process.stderr.write(chunk);
        callback(erro as Error);
      }
    },
  });
}

export const logger = pino(
  {
    name: 'gestor-api',
    level: process.env.LOG_NIVEL ?? (ambiente === 'production' ? 'info' : 'debug'),
    base: {
      servico: 'gestor-api',
      ambiente,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  ambiente === 'production' ? undefined : criarDestinoLegivel(),
);
