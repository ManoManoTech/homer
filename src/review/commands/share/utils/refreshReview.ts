import { logger } from '@/core/services/logger';
import { getPermalink, slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

export async function refreshReview(
  payload: BlockActionsPayloadWithChannel,
  action: StaticSelectAction,
) {
  const mergeRequestAction = action.selected_option.value;
  const { channel, user, message } = payload;
  const [projectIdStr, mergeRequestIidStr] =
    extractActionParameters(mergeRequestAction);

  if (!projectIdStr || !mergeRequestIidStr) {
    logger.error(
      new Error(
        `Unable to get projectId and mergeRequestIid for action ${mergeRequestAction}.`,
      ),
    );
    return;
  }

  const projectId = parseInt(projectIdStr, 10);
  const mergeRequestIid = parseInt(mergeRequestIidStr, 10);
  const { ts } = message;

  const [reviewMessage, permalink] = await Promise.all([
    buildReviewMessage(channel.id, projectId, mergeRequestIid, ts),
    getPermalink(channel.id, ts),
  ]);

  await slackBotWebClient.chat.update(reviewMessage);

  await slackBotWebClient.chat.postEphemeral({
    channel: channel.id,
    user: user.id,
    text: `Review message refreshed :homer-happy: ${permalink}`,
  });
}
