import { rebaseMergeRequest } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';

export async function rebaseSourceBranch(
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

  await rebaseMergeRequest(
    parseInt(projectId, 10),
    parseInt(mergeRequestIid, 10)
  );

  await slackBotWebClient.chat.postEphemeral({
    channel: channel.id,
    user: user.id,
    text: 'Rebase in progress :homer-donut:',
  });
}
