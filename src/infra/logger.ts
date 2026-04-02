import pino from 'pino';

const ambiente = process.env.NODE_ENV ?? 'development';

export const logger = pino({
  name: 'gestor-api',
  level: process.env.LOG_NIVEL ?? (ambiente === 'production' ? 'info' : 'debug'),
  base: {
    servico: 'gestor-api',
    ambiente,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

