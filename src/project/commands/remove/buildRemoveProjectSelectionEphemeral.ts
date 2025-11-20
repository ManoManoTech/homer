import type { ChatPostEphemeralArguments } from '@slack/web-api';
import { getProjectsByChannelId } from '@/core/services/data';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
import { getProjectIdValue } from '@/core/typings/Data';
import { injectActionsParameters } from '@/core/utils/slackActions';

interface RemoveProjectSelectionEphemeralData {
  channelId: string;
  userId: string;
}

export async function buildRemoveProjectSelectionEphemeral({
  channelId,
  userId,
}: RemoveProjectSelectionEphemeralData): Promise<ChatPostEphemeralArguments> {
  const dataProjects = await getProjectsByChannelId(channelId);
  const projects = await Promise.all(
    dataProjects.map(async (dataProject) => {
      const projectId = getProjectIdValue(dataProject);
      const provider = ProviderFactory.getProviderForProject(projectId);
      const project = await provider.fetchProject(projectId);
      // Return in GitLab format for compatibility
      return {
        id: typeof project.id === 'number' ? project.id : project.id,
        path_with_namespace: project.pathWithNamespace,
      };
    })
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
            .sort((a, b) =>
              a.path_with_namespace.localeCompare(b.path_with_namespace)
            )
            .map((project) => ({
              text: {
                type: 'plain_text',
                text: project.path_with_namespace,
              },
              value: injectActionsParameters(
                'project',
                project.id,
                project.path_with_namespace
              ),
            })),
        },
      },
    ],
  };
}
