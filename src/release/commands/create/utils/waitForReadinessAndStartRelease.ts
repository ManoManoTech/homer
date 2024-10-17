import {
  getProjectRelease,
  hasRelease,
  removeRelease,
  updateRelease,
} from '@/core/services/data';
import { fetchProjectById } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import type { DatabaseEntry, DataRelease } from '@/core/typings/Data';
import { getBranchLastPipeline } from '@/release/commands/create/utils/getBranchLastPipeline';
import { startRelease } from '@/release/commands/create/utils/startRelease';
import getReleaseOptions from '@/release/releaseOptions';
import type { ReleaseManager } from '@/release/typings/ReleaseManager';
import ConfigHelper from '@/release/utils/ConfigHelper';

const READINESS_TIMEOUT_DELAY_MS = 45 * 60 * 1000; // 45 minutes
const READINESS_CHECK_DELAY_MS = 30 * 1000; // 30 seconds

export async function waitForReadinessAndStartRelease(
  release: DataRelease,
  notifyUserIfNotReady = true
): Promise<void> {
  const { createdAt, description, projectId, slackAuthor, tagName } =
    release as DatabaseEntry<DataRelease>;

  if (Date.now() - new Date(createdAt).getTime() > READINESS_TIMEOUT_DELAY_MS) {
    logger.error(
      `The release ${tagName} of project ${projectId} is obsolete because it has already reached timeout so it will be removed.`
    );
    await removeRelease(projectId, tagName);
    return;
  }

  const { releaseChannelId, releaseManager, hasReleasePipeline } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  const project = await fetchProjectById(projectId);

  const mainBranchPipeline = await getBranchLastPipeline(
    projectId,
    project.default_branch
  );

  let hasReachedTimeout = false;
  let isReady = await releaseManager.isReadyToRelease(
    release,
    mainBranchPipeline.id,
    getReleaseOptions()
  );

  if (!isReady) {
    [{ hasReachedTimeout, isReady }] = await Promise.all([
      waitForReadiness(releaseManager, release, mainBranchPipeline.id),
      notifyUserIfNotReady
        ? slackBotWebClient.chat.postEphemeral({
            channel: releaseChannelId,
            user: slackAuthor.id,
            text: `The preconditions to launch a release are not yet met, I will \
wait for them and start the release automatically (<${mainBranchPipeline.web_url}|pipeline>) :homer-donut:`,
          })
        : Promise.resolve(),
    ]);

    const releaseState = (await getProjectRelease(projectId, tagName))?.state;

    if (releaseState !== 'notYetReady') {
      logger.error(
        `Potential concurrency issue detected for release ${tagName} of project ${projectId}.`
      );
      return;
    }
  }

  if (isReady) {
    await Promise.all([
      startRelease({
        commitId: mainBranchPipeline.sha,
        description,
        project,
        releaseCreator: slackAuthor,
        releaseTagName: tagName,
        hasReleasePipeline,
      }),
      updateRelease(project.id, tagName, () => ({
        state: 'created',
      })),
    ]);
  } else if (hasReachedTimeout) {
    await Promise.all([
      removeRelease(projectId, tagName),
      slackBotWebClient.chat.postEphemeral({
        channel: releaseChannelId,
        user: slackAuthor.id,
        text: `Timeout has been reached while waiting for the <${mainBranchPipeline.web_url}|pipeline> to be ready :homer-stressed: Please launch a new release :homer-donut:`,
      }),
    ]);
  }
}

async function waitForReadiness(
  releaseManager: ReleaseManager,
  release: DataRelease,
  mainBranchPipelineId: number
): Promise<{ hasReachedTimeout: boolean; isReady: boolean }> {
  const { projectId, tagName } = release;
  let hasReachedTimeout = false;
  let isReady = false;

  const timeout = setTimeout(() => {
    logger.error(
      `Readiness timeout reached for release ${tagName} of project ${projectId}`
    );
    hasReachedTimeout = true;
  }, READINESS_TIMEOUT_DELAY_MS);

  while (!hasReachedTimeout) {
    const doesReleaseExist = await hasRelease(projectId, tagName);

    if (!doesReleaseExist) {
      clearTimeout(timeout);
      break;
    }

    isReady = await releaseManager.isReadyToRelease(
      release,
      mainBranchPipelineId,
      getReleaseOptions()
    );

    if (isReady) {
      clearTimeout(timeout);
      break;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, READINESS_CHECK_DELAY_MS);
    });
  }
  return { hasReachedTimeout, isReady };
}
