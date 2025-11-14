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
  
  // Only use pino-pretty if available (it's a devDependency)
  // This prevents errors in Docker builds with --production flag
  try {
    // Check if pino-pretty is available before setting transport
    require.resolve('pino-pretty');
    pinoConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    };
  } catch (error) {
    // pino-pretty not available, use default JSON formatter
    // This is expected in production Docker builds
    console.warn('pino-pretty not available, using default JSON formatter');
  }
}

export const logger = pino(pinoConfig);
