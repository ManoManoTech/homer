import { logger } from '@/core/services/logger';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { parseProjectRef } from '@/core/utils/projectRef';
import { extractActionParameters } from '@/core/utils/slackActions';

export async function rebaseSourceBranch(
  payload: BlockActionsPayloadWithChannel,
  action: StaticSelectAction,
) {
  const mergeRequestAction = action.selected_option.value;
  const { channel, user } = payload;
  const [projectRef, mergeRequestIid] =
    extractActionParameters(mergeRequestAction);

  if (!projectRef || !mergeRequestIid) {
    logger.error(
      new Error(
        `Unable to get projectId and mergeRequestIid for action ${mergeRequestAction}.`,
      ),
    );
    return;
  }

  const { projectId, provider } = parseProjectRef(projectRef);

  await getProvider(provider).rebasePullRequest(
    projectId,
    parseInt(mergeRequestIid, 10),
  );

  await slackBotWebClient.chat.postEphemeral({
    channel: channel.id,
    user: user.id,
    text: 'Rebase in progress :homer-donut:',
  });
}
