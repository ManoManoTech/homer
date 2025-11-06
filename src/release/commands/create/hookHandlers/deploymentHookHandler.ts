import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from '@slack/web-api';
import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { hasRelease, removeRelease, updateRelease } from '@/core/services/data';
import { fetchDeploymentById } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import type { GitlabDeploymentStatus } from '@/core/typings/GitlabDeployment';
import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import { buildReleaseMessage } from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '../../../utils/ConfigHelper';
import { buildReleaseStateNotificationMessage } from '../viewBuilders/buildReleaseStateNotificationMessage';

const STATUSES_TO_HANDLE: GitlabDeploymentStatus[] = [
  'failed',
  'running',
  'success',
];

export async function deploymentHookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const deploymentHook = req.body as GitlabDeploymentHook;
  const {
    deployment_id: deploymentId,
    environment,
    project,
    status,
  } = deploymentHook;
  const projectId = project.id;

  const hasProjectReleaseConfig =
    await ConfigHelper.hasProjectReleaseConfig(projectId);

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
        failedDeployments: [
          ...failedDeployments.filter(
            (failedDeployment) => failedDeployment.environment !== environment,
          ),
          { environment, date: deploymentHook.status_changed_at },
        ],
      });
      break;

    case 'running':
      updateGetter = ({ startedDeployments }) => ({
        startedDeployments: [
          ...startedDeployments.filter(
            (startedDeployment) =>
              startedDeployment.environment !== environment,
          ),
          { environment, date: deploymentHook.status_changed_at },
        ],
      });
      break;

    case 'success':
      updateGetter = ({ failedDeployments, successfulDeployments }) => ({
        failedDeployments: failedDeployments.filter(
          (failedDeployment) => failedDeployment.environment !== environment,
        ),
        successfulDeployments: [
          ...successfulDeployments.filter(
            (successfulDeployment) =>
              successfulDeployment.environment !== environment,
          ),
          { environment, date: deploymentHook.status_changed_at },
        ],
      });
      break;

    default:
      throw new Error(`Unhandled job status: ${status}`);
  }

  const release = await updateRelease(projectId, releaseTagName, updateGetter);
  const { notificationChannelIds, releaseChannelId, releaseManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId);

  const releaseStateUpdates = await releaseManager.getReleaseStateUpdate(
    release,
    deploymentHook,
    getReleaseOptions(),
  );

  if (releaseStateUpdates.length > 0) {
    await Promise.all(
      notificationChannelIds.map(async (channelId) =>
        slackBotWebClient.chat.postMessage(
          buildReleaseStateNotificationMessage({
            channelId,
            pipelineUrl: deployment.deployable.pipeline.web_url,
            projectPathWithNamespace: project.path_with_namespace,
            projectWebUrl: project.web_url,
            releaseCreator: release.slackAuthor,
            releaseStateUpdates,
            releaseTagName: deployment.ref,
          }),
        ),
      ),
    );

    const releaseMessage = buildReleaseMessage({
      releaseChannelId,
      release,
      releaseStateUpdates,
      project,
      pipelineUrl: deployment.deployable.pipeline.web_url,
    });

    if (release.ts === undefined || release.ts === null) {
      const { ts } = await slackBotWebClient.chat.postMessage(
        releaseMessage as ChatPostMessageArguments,
      );
      await updateRelease(projectId, releaseTagName, () => ({ ts }));
    } else {
      await slackBotWebClient.chat.update(
        releaseMessage as ChatUpdateArguments,
      );
    }

    const isReleaseCompleted = releaseStateUpdates.some(
      (update) =>
        update.deploymentState === 'completed' &&
        ['production', 'support'].includes(update.environment),
    );

    if (isReleaseCompleted) {
      await removeRelease(projectId, deployment.ref);
      return;
    }

    const isReleaseBeingMonitored = releaseStateUpdates.some(
      (update) =>
        update.deploymentState === 'monitoring' &&
        ['production', 'support'].includes(update.environment),
    );

    if (isReleaseBeingMonitored) {
      await updateRelease(projectId, releaseTagName, () => ({
        state: 'monitoring',
      }));
    }
  }
}
