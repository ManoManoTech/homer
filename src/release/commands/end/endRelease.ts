import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from '@slack/web-api';
import { getProjectRelease, removeRelease } from '@/core/services/data';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import { DEFAULT_PROVIDER, type ProviderType } from '@/core/typings/Provider';
import {
  buildReleaseMessage,
  toReleaseMessageProject,
} from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import { buildReleaseStateNotificationMessage } from '@/release/commands/create/viewBuilders/buildReleaseStateNotificationMessage';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '@/release/utils/ConfigHelper';

export async function endRelease(
  projectId: number,
  tagName: string,
  providerType: ProviderType = DEFAULT_PROVIDER,
) {
  const provider = getProvider(providerType);
  const release = await getProjectRelease(projectId, tagName, providerType);

  if (release === undefined) {
    throw new Error('Release to end not found');
  }

  const { notificationChannelIds, releaseChannelId, releaseManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId, providerType);

  const releaseStateUpdates = await releaseManager.getReleaseStateUpdate(
    release,
    undefined,
    getReleaseOptions(),
  );

  if (releaseStateUpdates.length > 0) {
    const [project, [pipeline]] = await Promise.all([
      provider.fetchProject(projectId),
      provider.fetchPipelinesByRef(projectId, release.tagName),
    ]);

    await Promise.all(
      notificationChannelIds.map(async (channelId) =>
        slackBotWebClient.chat.postMessage(
          buildReleaseStateNotificationMessage({
            channelId,
            pipelineUrl: pipeline.webUrl,
            projectPathWithNamespace: project.path,
            projectWebUrl: project.webUrl,
            releaseCreator: release.slackAuthor,
            releaseStateUpdates,
            releaseTagName: release.tagName,
          }),
        ),
      ),
    );

    const releaseMessage = buildReleaseMessage({
      releaseChannelId,
      release,
      releaseStateUpdates,
      project: toReleaseMessageProject(project),
      pipelineUrl: pipeline.webUrl,
    });

    if (release.ts === undefined || release.ts === null) {
      await slackBotWebClient.chat.postMessage(
        releaseMessage as ChatPostMessageArguments,
      );
    } else {
      await slackBotWebClient.chat.update(
        releaseMessage as ChatUpdateArguments,
      );
    }
  }
  await removeRelease(projectId, release.tagName, providerType);
}
