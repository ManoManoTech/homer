import { deleteEphemeralMessage } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { endRelease } from '@/release/commands/end/endRelease';

export async function selectReleaseToEnd(
  payload: BlockActionsPayload,
  action: StaticSelectAction,
) {
  const { response_url } = payload;
  await deleteEphemeralMessage(response_url);

  const [projectIdAsString, tagName] = extractActionParameters(
    action.selected_option.value,
  );
  const projectId = parseInt(projectIdAsString, 10);

  await endRelease(projectId, tagName);
}
