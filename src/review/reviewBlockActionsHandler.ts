import { logger } from '@/core/services/logger';
import { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { handleMessageAction } from './commands/share/utils/handleMessageActions';
import { selectMergeRequest } from './commands/share/utils/selectMergeRequest';

export async function reviewBlockActionsHandler(
  payload: BlockActionsPayloadWithChannel
): Promise<void> {
  await Promise.all(
    payload.actions.map(async (action) => {
      const { action_id } = action;

      switch (action_id) {
        case 'review-message-actions':
          return handleMessageAction(payload, action as StaticSelectAction);

        case 'review-select-merge-request':
          return selectMergeRequest(payload, action as StaticSelectAction);

        default:
          logger.error(new Error(`Unknown review block action: ${action_id}`));
      }
    })
  );
}
