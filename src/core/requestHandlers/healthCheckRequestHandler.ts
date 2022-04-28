import { Request, Response } from 'express';

export function healthCheckRequestHandler(_: Request, res: Response) {
  res.send('🍩');
}
