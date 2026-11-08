import type { ChatPostEphemeralArguments } from '@slack/web-api';
import slackifyMarkdown from 'slackify-markdown';
import type { UnifiedProject } from '@/core/typings/UnifiedModels';

interface BuildProjectListEphemeralData {
  channelId: string;
  displayTitle: boolean;
  projects: UnifiedProject[];
  userId: string;
}

export function buildProjectListEphemeral({
  channelId,
  displayTitle,
  projects,
  userId,
}: BuildProjectListEphemeralData): ChatPostEphemeralArguments {
  const formattedProjects = projects
    .map(({ path, webUrl }) => `- [${path}](${webUrl})`)
    .join('\n');

  const formattedProjectsFallback = projects.map(({ path }) => path).join(', ');

  return {
    channel: channelId,
    user: userId,
    text:
      projects.length > 0
        ? `${
            displayTitle ? 'Channel projects: ' : ''
          }${formattedProjectsFallback}.`
        : 'No project has been added to this channel yet.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            projects.length > 0
              ? slackifyMarkdown(
                  displayTitle
                    ? `**Channel projects:**\n${formattedProjects}`
                    : formattedProjects,
                )
              : 'No project has been added to this channel yet :homer-metal:',
        },
      },
    ],
  };
}
