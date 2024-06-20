import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { viewSubmissionRequestHandler } from '@/core/requestHandlers/interactiveRequestHandlers/viewSubmissionRequestHandler';
import { logger } from '@/core/services/logger';
import { blockActionsRequestHandler } from './interactiveRequestHandlers/blockActionsRequestHandler';

export async function interactiveRequestHandler(
  req: Request,
  res: Response
): Promise<void> {
  const payload = JSON.parse(req.body.payload); // Not parsed by the middleware
  const { type } = payload;

  switch (payload.type) {
    case 'block_actions':
      return blockActionsRequestHandler(req, res, payload);

    case 'view_submission':
      return viewSubmissionRequestHandler(req, res, payload);

    default:
      logger.error(new Error(`Unknown interactive type: ${type}`));
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
  }
}
