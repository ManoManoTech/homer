import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { hasRelease, removeRelease, updateRelease } from '@/core/services/data';
import { fetchDeploymentById } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import type { GitlabDeploymentStatus } from '@/core/typings/GitlabDeployment';
import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '../../../utils/ConfigHelper';
import { buildReleaseStateMessage } from '../viewBuilders/buildReleaseStateMessage';

const STATUSES_TO_HANDLE: GitlabDeploymentStatus[] = [
  'failed',
  'running',
  'success',
];

export async function deploymentHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const deploymentHook = req.body as GitlabDeploymentHook;
  const {
    deployment_id: deploymentId,
    environment,
    project,
    status,
  } = deploymentHook;
  const projectId = project.id;

  const hasProjectReleaseConfig = await ConfigHelper.hasProjectReleaseConfig(
    projectId
  );

  if (!STATUSES_TO_HANDLE.includes(status) || !hasProjectReleaseConfig) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  const deployment = await fetchDeploymentById(projectId, deploymentId);
  const releaseTagName = deployment.ref;

  if (!(await hasRelease(projectId, releaseTagName))) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }
  res.sendStatus(HTTP_STATUS_OK);

  let updateGetter: (release: DataRelease) => Partial<DataRelease>;

  switch (status) {
    case 'failed':
      updateGetter = ({ failedDeployments }) => ({
        failedDeployments: [...new Set([...failedDeployments, environment])],
      });
      break;

    case 'running':
      updateGetter = ({ startedDeployments }) => ({
        startedDeployments: [...new Set([...startedDeployments, environment])],
      });
      break;

    case 'success':
      updateGetter = ({ failedDeployments, successfulDeployments }) => ({
        failedDeployments: failedDeployments.filter((e) => e !== environment),
        successfulDeployments: [
          ...new Set([...successfulDeployments, environment]),
        ],
      });
      break;

    default:
      throw new Error(`Unhandled job status: ${status}`);
  }

  const release = await updateRelease(projectId, releaseTagName, updateGetter);
  const { notificationChannelIds, releaseManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  const releaseStateUpdates = await releaseManager.getReleaseStateUpdate(
    release,
    deploymentHook,
    getReleaseOptions()
  );

  if (releaseStateUpdates.length > 0) {
    await Promise.all(
      notificationChannelIds.map(async (channelId) =>
        slackBotWebClient.chat.postMessage(
          buildReleaseStateMessage({
            channelId,
            pipelineUrl: deployment.deployable.pipeline.web_url,
            projectPathWithNamespace: project.path_with_namespace,
            projectWebUrl: project.web_url,
            releaseCreator: release.slackAuthor,
            releaseStateUpdates,
            releaseTagName: deployment.ref,
          })
        )
      )
    );

    const isReleaseCompleted = releaseStateUpdates.some(
      (update) =>
        update.deploymentState === 'completed' &&
        ['production', 'support'].includes(update.environment)
    );

    if (isReleaseCompleted) {
      await removeRelease(projectId, deployment.ref);
      return;
    }

    const isReleaseBeingMonitored = releaseStateUpdates.some(
      (update) =>
        update.deploymentState === 'monitoring' &&
        ['production', 'support'].includes(update.environment)
    );

    if (isReleaseBeingMonitored) {
      await updateRelease(projectId, releaseTagName, () => ({
        state: 'monitoring',
      }));
    }
  }
}
