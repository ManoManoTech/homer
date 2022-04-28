import { Request, Response } from 'express';
import { HTTP_STATUS_OK } from '@/constants';
import { logger } from '@/core/services/logger';
import { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import { projectBlockActionsHandler } from '@/project/projectBlockActionsHandler';
import { reviewBlockActionsHandler } from '@/review/reviewBlockActionsHandler';

export async function blockActionsRequestHandler(
  req: Request,
  res: Response,
  payload: BlockActionsPayloadWithChannel
): Promise<void> {
  res.sendStatus(HTTP_STATUS_OK);

  await Promise.all(
    payload.actions.map(async (action) => {
      const { action_id } = action;

      if (action_id === undefined) {
        return;
      }

      switch (true) {
        case action_id.startsWith('project'):
          return projectBlockActionsHandler(payload);

        case action_id.startsWith('review'):
          return reviewBlockActionsHandler(payload);

        default:
          logger.error(new Error(`Unknown block action: ${action_id}`));
      }
    })
  );
}
