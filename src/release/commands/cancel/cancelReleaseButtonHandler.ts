import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { ButtonAction } from '@/core/typings/ButtonAction';
import { parseProjectRef } from '@/core/utils/projectRef';
import { extractActionParameters } from '@/core/utils/slackActions';
import { cancelRelease } from '@/release/commands/cancel/cancelRelease';

export async function cancelReleaseButtonHandler(
  payload: BlockActionsPayload,
  { value }: ButtonAction,
) {
  const { container, user } = payload;
  const { channel_id: channelId } = container;
  const [projectRef, tagName] = extractActionParameters(value);
  const { projectId, provider } = parseProjectRef(projectRef);

  await cancelRelease(projectId, tagName, channelId, user.id, provider);
}
