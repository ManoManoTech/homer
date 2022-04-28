import { ChatPostEphemeralArguments } from '@slack/web-api';
import slackifyMarkdown from 'slackify-markdown';
import { GitlabProject } from '@/core/typings/GitlabProject';

interface BuildProjectListEphemeralData {
  channelId: string;
  projects: GitlabProject[];
  userId: string;
}

export function buildProjectListEphemeral({
  channelId,
  projects,
  userId,
}: BuildProjectListEphemeralData): ChatPostEphemeralArguments {
  const formattedProjects = projects
    .map(
      ({ path_with_namespace, web_url }) =>
        `- [${path_with_namespace}](${web_url})`
    )
    .sort()
    .join('\n');

  const formattedProjectsFallback = projects
    .map(({ path_with_namespace }) => path_with_namespace)
    .sort()
    .join(', ');

  return {
    channel: channelId,
    user: userId,
    text:
      projects.length > 0
        ? `Channel projects: ${formattedProjectsFallback}.`
        : 'No project has been added to this channel yet.',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            projects.length > 0
              ? slackifyMarkdown(`**Channel projects:**\n${formattedProjects}`)
              : 'No project has been added to this channel yet :homer-metal:',
        },
      },
    ],
  };
}
