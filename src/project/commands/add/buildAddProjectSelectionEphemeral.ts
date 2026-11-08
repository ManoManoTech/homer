import type { ChatPostEphemeralArguments } from '@slack/web-api';
import type { UnifiedProject } from '@/core/typings/UnifiedModels';
import { formatProjectRef } from '@/core/utils/projectRef';
import { injectActionsParameters } from '@/core/utils/slackActions';
import { truncateProjectPath } from '@/core/utils/truncateProjectPath';

interface AddProjectSelectionEphemeralData {
  channelId: string;
  projects: UnifiedProject[];
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
