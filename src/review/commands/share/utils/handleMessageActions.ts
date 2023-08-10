import { removeReview } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { createPipeline } from './createPipeline';
import { rebaseSourceBranch } from './rebaseSourceBranch';

export async function handleMessageAction(
  payload: BlockActionsPayloadWithChannel,
  action: StaticSelectAction
) {
  const mergeRequestAction = action.selected_option.value;

  if (mergeRequestAction.startsWith('review-create-pipeline')) {
    await createPipeline(payload, action);
  } else if (mergeRequestAction === 'review-delete-message') {
    const { channel, message } = payload;
    const { ts } = message;

    await slackBotWebClient.chat.delete({ channel: channel.id, ts });
    await removeReview(ts);
  } else if (mergeRequestAction.startsWith('review-rebase-source-branch')) {
    await rebaseSourceBranch(payload, action);
  } else {
    logger.error(
      new Error(`Unknown review message action: ${mergeRequestAction}.`)
    );
  }
}
