import type { ChatPostEphemeralArguments } from '@slack/web-api';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import type { DataRelease } from '@/core/typings/Data';
import {
  formatProjectRef,
  getReleaseProjectRef,
} from '@/core/utils/projectRef';
import { injectActionsParameters } from '@/core/utils/slackActions';
import { truncateProjectPath } from '@/core/utils/truncateProjectPath';

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
      const { projectId, provider } = getReleaseProjectRef(release);
      const { path: projectPath } =
        await getProvider(provider).fetchProject(projectId);
      if (releaseGroups[projectPath] === undefined) {
        releaseGroups[projectPath] = [];
      }
      releaseGroups[projectPath].push(release);
    }),
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
                text: truncateProjectPath(projectPath),
              },
              options: projectReleases.map((release) => ({
                text: {
                  type: 'plain_text',
                  text: release.tagName,
                  emoji: true,
                },
                value: injectActionsParameters(
                  'release',
                  formatProjectRef(getReleaseProjectRef(release)),
                  release.tagName,
                ),
              })),
            })),
        },
      },
    ],
  };
}
