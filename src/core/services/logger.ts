import pino, { LoggerOptions } from 'pino';

const pinoConfig = {
  formatters: {
    level: (label) => ({ level: label }),
  },
  messageKey: 'message',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
} as LoggerOptions;

if (process.env.NODE_ENV !== 'production') {
  pinoConfig.level = 'debug';
  pinoConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  };
}

export const logger = pino(pinoConfig);
