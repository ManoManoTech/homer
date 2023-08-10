import { removeProjectFromChannel } from '@/core/services/data';
import {
  deleteEphemeralMessage,
  slackBotWebClient,
} from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';

export async function removeProject(
  payload: BlockActionsPayload,
  action: StaticSelectAction
) {
  const { container, response_url, user } = payload;
  const { channel_id } = container;
  const [projectId, projectName] = extractActionParameters(
    action.selected_option.value
  );

  await removeProjectFromChannel(parseInt(projectId, 10), channel_id);
  await deleteEphemeralMessage(response_url);
  await slackBotWebClient.chat.postEphemeral({
    channel: channel_id,
    user: user.id,
    text: `\`${projectName}\` removed from this channel :homer-happy:`,
  });
}
