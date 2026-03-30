import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '@/core/services/data';
import { logger } from '@/core/services/logger';

export async function readinessRequestHandler(_: Request, res: Response) {
  try {
    await checkDatabaseConnection();
    res.send('ready');
  } catch (error) {
    res.status(503).send('Database connection failed');
    logger.error(error, 'Database connection failed during readiness check');
  }
}
