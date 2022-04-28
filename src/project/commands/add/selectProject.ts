import { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import { deleteEphemeralMessage } from '@/core/services/slack';
import { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { addProject } from './addProject';

export async function selectProject(
  payload: BlockActionsPayload,
  action: StaticSelectAction
) {
  const { container, response_url, user } = payload;
  const { channel_id } = container;
  const [projectId, projectName] = extractActionParameters(
    action.selected_option.value
  );

  await deleteEphemeralMessage(response_url);
  await addProject(parseInt(projectId, 10), channel_id, user.id, projectName);
}
