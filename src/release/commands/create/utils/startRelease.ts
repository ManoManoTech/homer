import type { ChatPostMessageArguments } from '@slack/web-api';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import type { UnifiedProject } from '@/core/typings/UnifiedModels';
import { getReleaseProjectRef } from '@/core/utils/projectRef';
import {
  buildReleaseMessage,
  toReleaseMessageProject,
} from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import ConfigHelper from '../../../utils/ConfigHelper';
import { waitForReleasePipeline } from './waitForReleasePipeline';

interface StartReleaseData {
  project: UnifiedProject;
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
  const { provider } = getReleaseProjectRef(release);
  const { releaseChannelId } = await ConfigHelper.getProjectReleaseConfig(
    project.id,
    provider,
  );

  await getProvider(provider).createRelease(
    project.id,
    commitId,
    release.tagName,
    release.description,
  );

  let pipelineUrl = undefined;
  if (hasReleasePipeline) {
    const pipeline = await waitForReleasePipeline(
      project.id,
      release.tagName,
      provider,
    );
    pipelineUrl = pipeline?.webUrl;
  }

  const { ts } = await slackBotWebClient.chat.postMessage(
    buildReleaseMessage({
      releaseChannelId,
      release,
      releaseStateUpdates: [],
      project: toReleaseMessageProject(project),
      pipelineUrl,
    }) as ChatPostMessageArguments,
  );

  return ts as string;
}
