import { drawReviewers as drawReviewersGitlab } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';

export async function drawReviewers(
  payload: BlockActionsPayloadWithChannel,
  action: StaticSelectAction
) {
  const mergeRequestAction = action.selected_option.value;
  const { channel, user } = payload;
  const [projectId, mergeRequestIid] =
    extractActionParameters(mergeRequestAction);

  if (!projectId || !mergeRequestIid) {
    logger.error(
      new Error(
        `Unable to get projectId and mergeRequestIid for action ${mergeRequestAction}.`
      )
    );
    return;
  }
  try {
    const rawDrawnReviewers = await drawReviewersGitlab(
      parseInt(projectId, 10),
      parseInt(mergeRequestIid, 10)
    );

    const drawnReviewers = rawDrawnReviewers.map(({ name }) => `@${name}`);

    await slackBotWebClient.chat.postEphemeral({
      channel: channel.id,
      user: user.id,
      text: `Drawing done :homer-happy:, here are the reviewers ${drawnReviewers}`,
    });
  } catch {
    await slackBotWebClient.chat.postEphemeral({
      channel: channel.id,
      user: user.id,
      text: `Merge Request \`${mergeRequestIid}\` already has some reviewers :homer-stressed:`,
    });
  }
}
