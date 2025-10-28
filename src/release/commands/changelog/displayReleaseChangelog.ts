import { GENERIC_ERROR_MESSAGE } from '@/constants';
import { getProjectRelease } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { ButtonAction } from '@/core/typings/ButtonAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { buildReleaseChangelogModalView } from '@/release/commands/changelog/viewBuilders/buildReleaseChangelogModalView';

export async function displayReleaseChangelog(
  payload: BlockActionsPayload,
  action: ButtonAction,
) {
  const { container, trigger_id, user } = payload;
  const [projectIdAsString, tagName] = extractActionParameters(action.value);
  const projectId = parseInt(projectIdAsString, 10);

  const release = await getProjectRelease(projectId, tagName);

  if (release === undefined) {
    throw new Error('Release not found');
  }

  try {
    await slackBotWebClient.views.open({
      trigger_id,
      view: await buildReleaseChangelogModalView(release),
    });
  } catch (error) {
    await slackBotWebClient.chat.postEphemeral({
      channel: container.channel_id,
      user: user.id,
      text: error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE,
    });
  }
}
