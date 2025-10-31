import type { Request, Response } from 'express';
import { changelogBlockActionsHandler } from '@/changelog/changelogBlockActionsHandler';
import { HTTP_STATUS_OK } from '@/constants';
import { logger } from '@/core/services/logger';
import type { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import { projectBlockActionsHandler } from '@/project/projectBlockActionsHandler';
import { releaseBlockActionsHandler } from '@/release/releaseBlockActionsHandler';
import { reviewBlockActionsHandler } from '@/review/reviewBlockActionsHandler';

export async function blockActionsRequestHandler(
  req: Request,
  res: Response,
  payload: BlockActionsPayloadWithChannel,
): Promise<void> {
  res.sendStatus(HTTP_STATUS_OK);

  await Promise.all(
    payload.actions.map(async (action) => {
      const { action_id } = action;

      if (action_id === undefined) {
        return;
      }

      switch (true) {
        case action_id.startsWith('changelog'):
          return changelogBlockActionsHandler(payload);

        case action_id.startsWith('project'):
          return projectBlockActionsHandler(payload);

        case action_id.startsWith('release'):
          return releaseBlockActionsHandler(payload);

        case action_id.startsWith('review'):
          return reviewBlockActionsHandler(payload);

        case action_id == 'not-interactive':
          // In slack all the buttons are interactive even if you don't want it.
          // We use this action id to avoid irrelevant error logs
          return;

        default:
          logger.error(new Error(`Unknown block action: ${action_id}`));
      }
    }),
  );
}
