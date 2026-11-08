import { deleteEphemeralMessage } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { parseProjectRef } from '@/core/utils/projectRef';
import { extractActionParameters } from '@/core/utils/slackActions';
import { endRelease } from '@/release/commands/end/endRelease';

export async function selectReleaseToEnd(
  payload: BlockActionsPayload,
  action: StaticSelectAction,
) {
  const { response_url } = payload;
  await deleteEphemeralMessage(response_url);

  const [projectRef, tagName] = extractActionParameters(
    action.selected_option.value,
  );
  const { projectId, provider } = parseProjectRef(projectRef);

  await endRelease(projectId, tagName, provider);
}
