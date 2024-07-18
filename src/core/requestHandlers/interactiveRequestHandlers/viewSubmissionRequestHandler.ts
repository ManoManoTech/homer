import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { logger } from '@/core/services/logger';
import type { ModalViewSubmissionPayload } from '@/core/typings/ModalViewSubmissionPayload';
import { releaseViewSubmissionHandler } from '@/release/releaseViewSubmissionHandler';

export async function viewSubmissionRequestHandler(
  req: Request,
  res: Response,
  payload: ModalViewSubmissionPayload
): Promise<void> {
  const { callback_id } = payload.view;

  if (callback_id === undefined || callback_id === 'changelog-modal') {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }
  if (callback_id.startsWith('release')) {
    return releaseViewSubmissionHandler(req, res, payload);
  }
  res.sendStatus(HTTP_STATUS_NO_CONTENT);
  logger.error(new Error(`Unknown view callback id: ${callback_id}`));
}
