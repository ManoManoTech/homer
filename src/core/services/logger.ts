import type { LoggerOptions } from 'pino';
import pino from 'pino';

const pinoConfig: LoggerOptions = {
  formatters: {
    level: (label) => ({ level: label }),
  },
  messageKey: 'message',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

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
