import slackifyMarkdown from 'slackify-markdown';
import { createRelease as createGitlabRelease } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabProject } from '@/core/typings/GitlabProject';
import type { SlackUser } from '@/core/typings/SlackUser';
import ConfigHelper from '../../../utils/ConfigHelper';
import { waitForReleasePipeline } from './waitForReleasePipeline';

interface StartReleaseData {
  commitId: string;
  description: string;
  project: GitlabProject;
  releaseCreator: SlackUser;
  releaseTagName: string;
  hasReleasePipeline: boolean | undefined;
}

export async function startRelease({
  commitId,
  description,
  project,
  releaseCreator,
  releaseTagName,
  hasReleasePipeline = true,
}: StartReleaseData): Promise<void> {
  const { releaseChannelId } = await ConfigHelper.getProjectReleaseConfig(
    project.id
  );

  await createGitlabRelease(project.id, commitId, releaseTagName, description);

  await slackBotWebClient.chat.postEphemeral({
    channel: releaseChannelId,
    user: releaseCreator.id,
    text: `Release \`${releaseTagName}\` started for \`${project.path}\` :homer-happy:`,
  });

  if (hasReleasePipeline) {
    const pipeline = await waitForReleasePipeline(project.id, releaseTagName);
    const pipelineUrl = pipeline?.web_url;

    if (pipelineUrl) {
      await slackBotWebClient.chat.postEphemeral({
        channel: releaseChannelId,
        user: releaseCreator.id,
        text: `↳ <${pipelineUrl}|pipeline> :homer-donut:`,
      });
    }
  }

  await slackBotWebClient.chat.postMessage({
    channel: releaseChannelId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:homer: New release <${
            project.web_url
          }/-/releases/${releaseTagName}|${releaseTagName}> for project <${
            project.web_url
          }|${project.path_with_namespace}>${
            description
              ? `:\n${slackifyMarkdown(description)
                  .split('\n')
                  .filter(Boolean)
                  .map((line) => `  ${line}`)
                  .join('\n')}`
              : '.'
          }`,
        },
      },
    ],
    icon_url: releaseCreator.profile.image_72,
    text: `New release ${releaseTagName} for project ${project.path_with_namespace}.`,
    username: releaseCreator.real_name,
  });
}
