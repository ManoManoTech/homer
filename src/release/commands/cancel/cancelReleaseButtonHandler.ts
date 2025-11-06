import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { ButtonAction } from '@/core/typings/ButtonAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { cancelRelease } from '@/release/commands/cancel/cancelRelease';

export async function cancelReleaseButtonHandler(
  payload: BlockActionsPayload,
  { value }: ButtonAction,
) {
  const { container, user } = payload;
  const { channel_id: channelId } = container;
  const [projectIdAsString, tagName] = extractActionParameters(value);
  const projectId = parseInt(projectIdAsString, 10);

  await cancelRelease(projectId, tagName, channelId, user.id);
}
