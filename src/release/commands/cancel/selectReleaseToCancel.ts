import { deleteEphemeralMessage } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { cancelRelease } from '@/release/commands/cancel/cancelRelease';

export async function selectReleaseToCancel(
  payload: BlockActionsPayload,
  action: StaticSelectAction,
) {
  const { container, response_url: responseUrl, user } = payload;
  const { channel_id: channelId } = container;
  const [projectIdAsString, tagName] = extractActionParameters(
    action.selected_option.value,
  );
  const projectId = parseInt(projectIdAsString, 10);

  await deleteEphemeralMessage(responseUrl);

  await cancelRelease(projectId, tagName, channelId, user.id);
}
