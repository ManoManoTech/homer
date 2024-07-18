import type { ChatPostEphemeralArguments } from '@slack/web-api';
import { fetchProjectById } from '@/core/services/gitlab';
import type { DataRelease } from '@/core/typings/Data';
import { injectActionsParameters } from '@/core/utils/slackActions';

interface ReleaseSelectionEphemeralData {
  action: string;
  channelId: string;
  releases: DataRelease[];
  userId: string;
}

export async function buildReleaseSelectionEphemeral({
  action,
  channelId,
  releases,
  userId,
}: ReleaseSelectionEphemeralData): Promise<ChatPostEphemeralArguments> {
  const releaseGroups: { [project: string]: DataRelease[] } = {};

  await Promise.all(
    releases.map(async (release) => {
      const { path_with_namespace: projectPath } = await fetchProjectById(
        release.projectId
      );
      if (releaseGroups[projectPath] === undefined) {
        releaseGroups[projectPath] = [];
      }
      releaseGroups[projectPath].push(release);
    })
  );

  return {
    channel: channelId,
    user: userId,
    text: `Choose a release to ${action}`,
    blocks: [
      {
        type: 'section',
        block_id: `release-select-release-${action}-block`,
        text: {
          type: 'mrkdwn',
          text: `Choose a release to ${action}:`,
        },
        accessory: {
          type: 'static_select',
          action_id: `release-select-release-${action}-action`,
          placeholder: {
            type: 'plain_text',
            text: 'Choose a release',
            emoji: true,
          },
          option_groups: Object.entries(releaseGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([projectPath, projectReleases]) => ({
              label: {
                type: 'plain_text',
                text: projectPath,
              },
              options: projectReleases.map(({ projectId, tagName }) => ({
                text: {
                  type: 'plain_text',
                  text: tagName,
                  emoji: true,
                },
                value: injectActionsParameters('release', projectId, tagName),
              })),
            })),
        },
      },
    ],
  };
}
