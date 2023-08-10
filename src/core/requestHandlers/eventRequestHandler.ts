import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { logger } from '@/core/services/logger';
import { appHomeOpenedHandler } from '@/home/appHomeOpenedHandler';

export async function eventRequestHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { body } = req;

  res.send(body.challenge);

  if (body.type !== 'event_callback') {
    return;
  }

  const { type } = body.event;

  switch (type) {
    case 'app_home_opened':
      return appHomeOpenedHandler(req);

    default:
      logger.error(new Error(`Unknown event type: ${type}`));
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
  }
}
