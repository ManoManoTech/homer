import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from '@slack/web-api';
import { getProjectRelease, removeRelease } from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { fetchSlackUserFromId, slackBotWebClient } from '@/core/services/slack';
import { DEFAULT_PROVIDER, type ProviderType } from '@/core/typings/Provider';
import { NOT_DEPLOYED_RELEASE_NAME_PREFIX } from '@/release/commands/create/utils/previousReleaseTagOptions';
import {
  buildReleaseCanceledMessage,
  toReleaseMessageProject,
} from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import ConfigHelper from '@/release/utils/ConfigHelper';

export async function cancelRelease(
  projectId: number,
  tagName: string,
  channelId: string,
  userId: string,
  providerType: ProviderType = DEFAULT_PROVIDER,
) {
  const provider = getProvider(providerType);
  const release = await getProjectRelease(projectId, tagName, providerType);

  if (release === undefined) {
    throw new Error('Release to cancel not found');
  }

  const { notificationChannelIds, releaseChannelId } =
    await ConfigHelper.getProjectReleaseConfig(projectId, providerType);

  let canceledBy = await fetchSlackUserFromId(userId);
  canceledBy = canceledBy ? canceledBy : release.slackAuthor;
  const project = await provider.fetchProject(projectId);

  switch (release.state) {
    case 'notYetReady':
      await removeRelease(projectId, tagName, providerType);
      break;

    case 'created': {
      const { name } = await provider.fetchRelease(projectId, tagName);
      const [pipeline] = await provider.fetchPipelinesByRef(
        projectId,
        release.tagName,
      );
      await Promise.all([
        provider.updateReleaseName(
          projectId,
          tagName,
          `${NOT_DEPLOYED_RELEASE_NAME_PREFIX}${name}`,
        ),
        removeRelease(projectId, tagName, providerType),
        pipeline && provider.cancelPipeline(projectId, pipeline.id),
      ]);

      const releaseNotesUrl = provider.getReleaseUrl(project, tagName);

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
    project: toReleaseMessageProject(project),
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
