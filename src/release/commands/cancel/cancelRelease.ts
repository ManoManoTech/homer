import type { ChatUpdateArguments } from '@slack/web-api';
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

  const isLegacyRelease = release.ts === undefined || release.ts === null;
  const { notificationChannelIds, releaseChannelId } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  let canceledBy = await fetchSlackUserFromId(userId);
  canceledBy = canceledBy ? canceledBy : release.slackAuthor;
  const project = await fetchProjectById(projectId);

  switch (release.state) {
    case 'notYetReady':
      await removeRelease(projectId, tagName);

      if (isLegacyRelease) {
        await slackBotWebClient.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: 'Release canceled :homer-donut:',
        });
      } else {
        await slackBotWebClient.chat.update(
          buildReleaseCanceledMessage({
            releaseChannelId,
            release,
            project,
            canceledBy,
            releaseStateUpdates: [],
          }) as ChatUpdateArguments,
        );
      }
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
        notificationChannelIds
          .filter(
            (notificationChannelId) =>
              isLegacyRelease || notificationChannelId !== releaseChannelId,
          )
          .map(async (notificationChannelId) =>
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

      if (!isLegacyRelease) {
        await slackBotWebClient.chat.update(
          buildReleaseCanceledMessage({
            releaseChannelId,
            release,
            project,
            canceledBy,
            releaseStateUpdates: [],
          }) as ChatUpdateArguments,
        );
      }

      break;
    }

    case 'monitoring':
      await slackBotWebClient.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: 'It is too late to cancel that release :homer-stressed:',
      });
      break;

    default:
      logger.error(new Error(`Unknown release state: ${release.state}`));
  }
}
