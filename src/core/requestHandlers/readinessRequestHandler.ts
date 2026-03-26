import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '@/core/services/data';

export async function readinessRequestHandler(_: Request, res: Response) {
  try {
    await checkDatabaseConnection();
    res.send('ready');
  } catch {
    res.status(503).send('Database connection failed');
  }
}
