import path from 'node:path';
import tracer from 'dd-trace';
import dotenv from 'dotenv';
import 'source-map-support/register';
import * as tsconfigPaths from 'tsconfig-paths';
import { compilerOptions } from '../tsconfig.json';

tsconfigPaths.register({
  baseUrl: compilerOptions.outDir,
  paths: compilerOptions.paths,
});

if (process.env.NODE_ENV === 'production') {
  tracer.init({ logInjection: true });
} else {
  dotenv.config({ path: path.join(process.cwd(), '.env.development') });
  dotenv.config();
}

Promise.all([import('@/core/services/logger'), import('./start')]).then(
  async ([{ logger }, { start }]) => {
    function errorHandler(error: unknown) {
      logger.error(error);
      process.exit(1);
    }
    process.on('uncaughtException', errorHandler);
    process.on('unhandledRejection', errorHandler);
    await start();
  }
);
