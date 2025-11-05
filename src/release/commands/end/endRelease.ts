import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from '@slack/web-api';
import { getProjectRelease, removeRelease } from '@/core/services/data';
import { fetchPipelinesByRef, fetchProjectById } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import { buildReleaseMessage } from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import { buildReleaseStateNotificationMessage } from '@/release/commands/create/viewBuilders/buildReleaseStateNotificationMessage';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '@/release/utils/ConfigHelper';

export async function endRelease(projectId: number, tagName: string) {
  const release = await getProjectRelease(projectId, tagName);

  if (release === undefined) {
    throw new Error('Release to end not found');
  }

  const { notificationChannelIds, releaseChannelId, releaseManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  const releaseStateUpdates = await releaseManager.getReleaseStateUpdate(
    release,
    undefined,
    getReleaseOptions(),
  );

  if (releaseStateUpdates.length > 0) {
    const [project, [pipeline]] = await Promise.all([
      fetchProjectById(projectId),
      fetchPipelinesByRef(projectId, release.tagName),
    ]);

    await Promise.all(
      notificationChannelIds.map(async (channelId) =>
        slackBotWebClient.chat.postMessage(
          buildReleaseStateNotificationMessage({
            channelId,
            pipelineUrl: pipeline.web_url,
            projectPathWithNamespace: project.path_with_namespace,
            projectWebUrl: project.web_url,
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
      project,
      pipelineUrl: pipeline.web_url,
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
  await removeRelease(projectId, release.tagName);
}
