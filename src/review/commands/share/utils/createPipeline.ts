import { runPipeline } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayloadWithChannel } from '@/core/typings/BlockActionPayload';
import type { GitlabCiVariable } from '@/core/typings/GitlabCiVariable';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';

export async function createPipeline(
  payload: BlockActionsPayloadWithChannel,
  action: StaticSelectAction
) {
  const mergeRequestAction = action.selected_option.value;
  const { channel, user } = payload;
  const [projectId, branchName, platformToDeploy] =
    extractActionParameters(mergeRequestAction);

  if (!projectId || !branchName) {
    logger.error(
      new Error(
        `Unable to get projectId and branchName for action ${mergeRequestAction}.`
      )
    );
    return;
  }

  let variables: GitlabCiVariable[] | undefined;

  if (platformToDeploy) {
    variables = [
      { key: 'AUTO_DEPLOY', value: platformToDeploy, variable_type: 'env_var' },
    ];
  }

  await runPipeline(parseInt(projectId, 10), branchName, variables);

  await slackBotWebClient.chat.postEphemeral({
    channel: channel.id,
    user: user.id,
    text: 'Pipeline created :homer-happy:',
  });
}
