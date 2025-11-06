import type { ChatPostMessageArguments } from '@slack/web-api';
import { createRelease as createGitlabRelease } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import type { GitlabProject } from '@/core/typings/GitlabProject';
import { buildReleaseMessage } from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import ConfigHelper from '../../../utils/ConfigHelper';
import { waitForReleasePipeline } from './waitForReleasePipeline';

interface StartReleaseData {
  project: GitlabProject;
  commitId: string;
  release: DataRelease;
  hasReleasePipeline: boolean | undefined;
}

export async function startRelease({
  project,
  commitId,
  release,
  hasReleasePipeline = true,
}: StartReleaseData): Promise<string> {
  const { releaseChannelId } = await ConfigHelper.getProjectReleaseConfig(
    project.id,
  );

  await createGitlabRelease(
    project.id,
    commitId,
    release.tagName,
    release.description,
  );

  let pipelineUrl = undefined;
  if (hasReleasePipeline) {
    const pipeline = await waitForReleasePipeline(project.id, release.tagName);
    pipelineUrl = pipeline?.web_url;
  }

  const { ts } = await slackBotWebClient.chat.postMessage(
    buildReleaseMessage({
      releaseChannelId,
      release,
      releaseStateUpdates: [],
      project,
      pipelineUrl,
    }) as ChatPostMessageArguments,
  );

  return ts as string;
}
