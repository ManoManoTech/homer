import type { Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { CONFIG } from '@/config';
import { errorMiddleware } from '@/core/middlewares/errorMiddleware';
import { securityMiddleware } from '@/core/middlewares/securityMiddleware';
import { healthCheckRequestHandler } from '@/core/requestHandlers/healthCheckRequestHandler';
import { REQUEST_BODY_SIZE_LIMIT } from './constants';
import { router } from './router';

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

export { app };
