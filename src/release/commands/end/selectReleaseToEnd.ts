import { getProjectRelease, removeRelease } from '@/core/services/data';
import { fetchPipelinesByRef, fetchProjectById } from '@/core/services/gitlab';
import {
  deleteEphemeralMessage,
  slackBotWebClient,
} from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { buildReleaseStateMessage } from '@/release/commands/create/viewBuilders/buildReleaseStateMessage';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '@/release/utils/ConfigHelper';

export async function selectReleaseToEnd(
  payload: BlockActionsPayload,
  action: StaticSelectAction
) {
  const { response_url } = payload;
  const [projectIdAsString, tagName] = extractActionParameters(
    action.selected_option.value
  );
  const projectId = parseInt(projectIdAsString, 10);

  await deleteEphemeralMessage(response_url);

  const release = await getProjectRelease(projectId, tagName);

  if (release === undefined) {
    throw new Error('Release to end not found');
  }

  const { notificationChannelIds, releaseManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  const releaseStateUpdates = await releaseManager.getReleaseStateUpdate(
    release,
    undefined,
    getReleaseOptions()
  );

  if (releaseStateUpdates.length > 0) {
    const [project, [pipeline]] = await Promise.all([
      fetchProjectById(projectId),
      fetchPipelinesByRef(projectId, release.tagName),
    ]);

    await Promise.all(
      notificationChannelIds.map(async (channelId) =>
        slackBotWebClient.chat.postMessage(
          buildReleaseStateMessage({
            channelId,
            pipelineUrl: pipeline.web_url,
            projectPathWithNamespace: project.path_with_namespace,
            projectWebUrl: project.web_url,
            releaseCreator: release.slackAuthor,
            releaseStateUpdates,
            releaseTagName: release.tagName,
          })
        )
      )
    );
  }
  await removeRelease(projectId, release.tagName);
}
