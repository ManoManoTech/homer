import { logger } from '@/core/services/logger';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { parseProjectRef } from '@/core/utils/projectRef';
import { extractActionParameters } from '@/core/utils/slackActions';

export async function createPipeline(
  payload: BlockActionsPayloadWithChannel,
  action: StaticSelectAction,
) {
  const mergeRequestAction = action.selected_option.value;
  const { channel, user } = payload;
  const [projectRef, branchName, platformToDeploy] =
    extractActionParameters(mergeRequestAction);

  if (!projectRef || !branchName) {
    logger.error(
      new Error(
        `Unable to get projectId and branchName for action ${mergeRequestAction}.`,
      ),
    );
    return;
  }

  const { projectId, provider } = parseProjectRef(projectRef);

  await getProvider(provider).runPipeline(
    projectId,
    branchName,
    platformToDeploy || undefined,
  );

  await slackBotWebClient.chat.postEphemeral({
    channel: channel.id,
    user: user.id,
    text: 'Pipeline created :homer-happy:',
  });
}
