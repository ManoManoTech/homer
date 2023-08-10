import type { ChatPostEphemeralArguments } from '@slack/web-api';
import type { GitlabProject } from '@/core/typings/GitlabProject';
import { injectActionsParameters } from '@/core/utils/slackActions';

interface AddProjectSelectionEphemeralData {
  channelId: string;
  projects: GitlabProject[];
  query: string;
  userId: string;
}

export function buildAddProjectSelectionEphemeral({
  channelId,
  projects,
  query,
  userId,
}: AddProjectSelectionEphemeralData): ChatPostEphemeralArguments {
  return {
    channel: channelId,
    user: userId,
    text: `Multiple projects match \`${query}\`. Choose one`,
    blocks: [
      {
        type: 'section',
        block_id: 'project-select-project-to-add-block',
        text: {
          type: 'mrkdwn',
          text: `Multiple projects match \`${query}\`. Choose one:`,
        },
        accessory: {
          type: 'static_select',
          action_id: 'project-select-project-to-add',
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
