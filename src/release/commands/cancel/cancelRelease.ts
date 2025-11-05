import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from '@slack/web-api';
import { getProjectRelease, removeRelease } from '@/core/services/data';
import {
  cancelPipeline,
  fetchPipelinesByRef,
  fetchProjectById,
  fetchReleaseByTagName,
  updateReleaseName,
} from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import { fetchSlackUserFromId, slackBotWebClient } from '@/core/services/slack';
import { buildReleaseCanceledMessage } from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import ConfigHelper from '@/release/utils/ConfigHelper';

export async function cancelRelease(
  projectId: number,
  tagName: string,
  channelId: string,
  userId: string,
) {
  const release = await getProjectRelease(projectId, tagName);

  if (release === undefined) {
    throw new Error('Release to cancel not found');
  }

  const { notificationChannelIds, releaseChannelId } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  let canceledBy = await fetchSlackUserFromId(userId);
  canceledBy = canceledBy ? canceledBy : release.slackAuthor;
  const project = await fetchProjectById(projectId);

  switch (release.state) {
    case 'notYetReady':
      await removeRelease(projectId, tagName);
      break;

    case 'created': {
      const { name } = await fetchReleaseByTagName(projectId, tagName);
      const [pipeline] = await fetchPipelinesByRef(projectId, release.tagName);
      await Promise.all([
        updateReleaseName(projectId, tagName, `[NOT DEPLOYED] ${name}`),
        removeRelease(projectId, tagName),
        cancelPipeline(projectId, pipeline.id),
      ]);

      const releaseNotesUrl = `${project.web_url}/-/releases/${tagName}`;

      await Promise.all(
        notificationChannelIds.map(async (notificationChannelId) =>
          slackBotWebClient.chat.postMessage({
            channel: notificationChannelId,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:homer: Release <${releaseNotesUrl}|${tagName}> canceled and marked as not deployed :homer-donut:`,
                },
              },
            ],
            icon_url: canceledBy?.profile.image_72,
            text: `Release <${releaseNotesUrl}|${tagName}> canceled and marked as not deployed.`,
            username: canceledBy?.real_name,
          }),
        ),
      );

      break;
    }

    case 'monitoring':
      await slackBotWebClient.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: 'It is too late to cancel that release :homer-stressed:',
      });
      return;

    default:
      logger.error(new Error(`Unknown release state: ${release.state}`));
      return;
  }

  const releaseCanceledMessage = buildReleaseCanceledMessage({
    releaseChannelId,
    release,
    project,
    canceledBy,
    releaseStateUpdates: [],
  });

  if (release.ts === undefined || release.ts === null) {
    await slackBotWebClient.chat.postMessage(
      releaseCanceledMessage as ChatPostMessageArguments,
    );
  } else {
    await slackBotWebClient.chat.update(
      releaseCanceledMessage as ChatUpdateArguments,
    );
  }
}
