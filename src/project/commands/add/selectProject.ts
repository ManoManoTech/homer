import { deleteEphemeralMessage } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { parseProjectRef } from '@/core/utils/projectRef';
import { extractActionParameters } from '@/core/utils/slackActions';
import { addProject } from './addProject';

export async function selectProject(
  payload: BlockActionsPayload,
  action: StaticSelectAction,
) {
  const { container, response_url, user } = payload;
  const { channel_id } = container;
  const [projectRef, projectName] = extractActionParameters(
    action.selected_option.value,
  );
  const { projectId, provider } = parseProjectRef(projectRef);

  await deleteEphemeralMessage(response_url);
  await addProject(
    { id: projectId, path: projectName, provider },
    channel_id,
    user.id,
  );
}
