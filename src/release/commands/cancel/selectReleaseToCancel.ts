import { getProjectRelease, removeRelease } from '@/core/services/data';
import {
  cancelPipeline,
  fetchPipelinesByRef,
  fetchProjectById,
  fetchReleaseByTagName,
  updateReleaseName,
} from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import {
  deleteEphemeralMessage,
  fetchSlackUserFromGitlabUsername,
  slackBotWebClient,
} from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { extractActionParameters } from '@/core/utils/slackActions';

export async function selectReleaseToCancel(
  payload: BlockActionsPayload,
  action: StaticSelectAction
) {
  const { container, response_url: responseUrl, user } = payload;
  const { channel_id: channelId } = container;
  const [projectIdAsString, tagName] = extractActionParameters(
    action.selected_option.value
  );
  const projectId = parseInt(projectIdAsString, 10);

  await deleteEphemeralMessage(responseUrl);

  const release = await getProjectRelease(projectId, tagName);

  if (release === undefined) {
    throw new Error('Release to cancel not found');
  }

  switch (release.state) {
    case 'notYetReady':
      await removeRelease(projectId, tagName);
      await slackBotWebClient.chat.postEphemeral({
        channel: channelId,
        user: user.id,
        text: 'Release canceled :homer-donut:',
      });
      break;

    case 'created': {
      const { name } = await fetchReleaseByTagName(projectId, tagName);
      const [project, slackUser] = await Promise.all([
        fetchProjectById(projectId),
        fetchSlackUserFromGitlabUsername(user.username),
        updateReleaseName(projectId, tagName, `[NOT DEPLOYED] ${name}`),
        removeRelease(projectId, tagName),
        fetchPipelinesByRef(projectId, tagName).then(([pipeline]) =>
          cancelPipeline(projectId, pipeline.id)
        ),
      ]);
      const releaseNotesUrl = `${project.web_url}/-/releases/${tagName}`;

      await slackBotWebClient.chat.postMessage({
        channel: channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:homer: Release <${releaseNotesUrl}|${tagName}> canceled and marked as not deployed :homer-donut:`,
            },
          },
        ],
        icon_url: slackUser?.profile.image_72,
        text: `Release <${releaseNotesUrl}|${tagName}> canceled and marked as not deployed.`,
        username: slackUser?.real_name,
      });
      break;
    }

    case 'monitoring':
      await slackBotWebClient.chat.postEphemeral({
        channel: channelId,
        user: user.id,
        text: 'It is too late to cancel that release :homer-stressed:',
      });
      break;

    default:
      logger.error(new Error(`Unknown release state: ${release.state}`));
  }
}
