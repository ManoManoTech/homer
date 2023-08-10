import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { logger } from '@/core/services/logger';
import type { ModalViewSubmissionPayload } from '@/core/typings/ModalViewSubmissionPayload';
import { createRelease } from './commands/create/utils/createRelease';
import { buildReleaseModalView } from './commands/create/viewBuilders/buildReleaseModalView';

export async function releaseViewSubmissionHandler(
  req: Request,
  res: Response,
  payload: ModalViewSubmissionPayload
): Promise<void> {
  const { callback_id } = payload.view;

  switch (callback_id) {
    case 'release-create-modal': {
      const { view } = payload;
      const { state } = view;

      if (state.values['release-tag-block'] === undefined) {
        res.json({
          response_action: 'update',
          view: await buildReleaseModalView({ view }),
        });
        return;
      }
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      await createRelease(payload);
      break;
    }

    default:
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      logger.error(
        new Error(`Unknown release view callback id: ${callback_id}`)
      );
  }
}
