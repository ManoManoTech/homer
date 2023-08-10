import type { ChatPostEphemeralArguments } from '@slack/web-api';
import slackifyMarkdown from 'slackify-markdown';
import type { GitlabProject } from '@/core/typings/GitlabProject';

interface BuildProjectListEphemeralData {
  channelId: string;
  displayTitle: boolean;
  projects: GitlabProject[];
  userId: string;
}

export function buildProjectListEphemeral({
  channelId,
  displayTitle,
  projects,
  userId,
}: BuildProjectListEphemeralData): ChatPostEphemeralArguments {
  const formattedProjects = projects
    .map(
      ({ path_with_namespace, web_url }) =>
        `- [${path_with_namespace}](${web_url})`
    )
    .join('\n');

  const formattedProjectsFallback = projects
    .map(({ path_with_namespace }) => path_with_namespace)
    .join(', ');

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
                    : formattedProjects
                )
              : 'No project has been added to this channel yet :homer-metal:',
        },
      },
    ],
  };
}
