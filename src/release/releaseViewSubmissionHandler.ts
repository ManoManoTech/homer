import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { logger } from '@/core/services/logger';
import type { ModalViewSubmissionPayload } from '@/core/typings/ModalViewSubmissionPayload';
import { getViewStateValue } from '@/core/utils/getViewStateValue';
import { createRelease } from './commands/create/utils/createRelease';
import { buildReleaseModalView } from './commands/create/viewBuilders/buildReleaseModalView';
import { RELEASE_TAG_ACTION_ID } from './commands/create/viewBuilders/releaseModalBlockIds';

export async function releaseViewSubmissionHandler(
  req: Request,
  res: Response,
  payload: ModalViewSubmissionPayload,
): Promise<void> {
  const { callback_id } = payload.view;

  switch (callback_id) {
    case 'release-create-modal': {
      const { view } = payload;

      if (getViewStateValue(view, RELEASE_TAG_ACTION_ID) === undefined) {
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

    case 'release-changelog-modal': {
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      break;
    }

    default:
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      logger.error(
        new Error(`Unknown release view callback id: ${callback_id}`),
      );
  }
}
