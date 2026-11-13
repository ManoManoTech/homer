import type { ChatPostEphemeralArguments } from '@slack/web-api';
import { getProjectsByChannelId } from '@/core/services/data';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { formatProjectRef } from '@/core/utils/projectRef';
import { injectActionsParameters } from '@/core/utils/slackActions';
import { truncateProjectPath } from '@/core/utils/truncateProjectPath';

interface RemoveProjectSelectionEphemeralData {
  channelId: string;
  userId: string;
}

export async function buildRemoveProjectSelectionEphemeral({
  channelId,
  userId,
}: RemoveProjectSelectionEphemeralData): Promise<ChatPostEphemeralArguments> {
  const projects = await Promise.all(
    (await getProjectsByChannelId(channelId)).map(({ projectId, provider }) =>
      getProvider(provider).fetchProject(projectId),
    ),
  );

  if (projects.length === 0) {
    return {
      channel: channelId,
      user: userId,
      text: 'This channel does not have any project.',
    };
  }

  return {
    channel: channelId,
    user: userId,
    text: 'Choose the project to remove',
    blocks: [
      {
        type: 'section',
        block_id: 'project-select-project-to-remove-block',
        text: {
          type: 'mrkdwn',
          text: `Choose the project to remove:`,
        },
        accessory: {
          type: 'static_select',
          action_id: 'project-select-project-to-remove',
          placeholder: {
            type: 'plain_text',
            text: 'Choose a project',
          },
          options: projects
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((project) => ({
              text: {
                type: 'plain_text',
                text: truncateProjectPath(project.path),
              },
              value: injectActionsParameters(
                'project',
                formatProjectRef({
                  provider: project.provider,
                  projectId: project.id,
                }),
                project.path,
              ),
            })),
        },
      },
    ],
  };
}
