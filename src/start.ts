import type { Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { CONFIG } from '@/config';
import { errorMiddleware } from '@/core/middlewares/errorMiddleware';
import { securityMiddleware } from '@/core/middlewares/securityMiddleware';
import { healthCheckRequestHandler } from '@/core/requestHandlers/healthCheckRequestHandler';
import { connectToDatabase } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { waitForNonReadyReleases } from '@/release/commands/create/utils/waitForNonReadyReleases';
import { REQUEST_BODY_SIZE_LIMIT } from './constants';
import { router } from './router';

const PORT = 3000;

export async function start(): Promise<() => Promise<void>> {
  return new Promise((resolve, reject) => {
    const app = express();

    const verify = (req: Request, res: Response, buffer: Buffer) => {
      (req as any).rawBody = buffer;
    };

    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(
      express.json({
        limit: REQUEST_BODY_SIZE_LIMIT,
        verify,
      }),
    );
    app.use(express.urlencoded({ extended: true, verify }));
    app.get('/api/monitoring/healthcheck', healthCheckRequestHandler);

    app.use(securityMiddleware);
    app.use(CONFIG.apiBasePath, router);
    app.use(errorMiddleware);

    const server = app.listen(PORT, async () => {
      try {
        await connectToDatabase();
      } catch (error) {
        reject(
          new Error(
            `Unable to connect to the database: ${
              (error as Error).stack ?? error
            }`,
          ),
        );
        return;
      }
      logger.info(`Homer started on port ${PORT}.`);
      waitForNonReadyReleases(); // Promise ignored on purpose
      resolve(
        async () =>
          new Promise((r) => {
            server.close(r as any);
          }),
      );
    });
  });
}
