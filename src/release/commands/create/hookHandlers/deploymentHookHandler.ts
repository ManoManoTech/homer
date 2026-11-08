import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { fetchDeploymentById } from '@/core/services/gitlab';
import type { GitlabDeploymentStatus } from '@/core/typings/GitlabDeployment';
import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import ConfigHelper from '../../../utils/ConfigHelper';
import { handleDeploymentEvent } from './handleDeploymentEvent';

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

  await handleDeploymentEvent(
    {
      provider: 'gitlab',
      projectId,
      project,
      environment,
      status: status as 'failed' | 'running' | 'success',
      statusChangedAt: deploymentHook.status_changed_at,
      ref: deployment.ref,
      pipelineUrl: deployment.deployable.pipeline.web_url,
      hook: deploymentHook,
    },
    (handled) =>
      res.sendStatus(handled ? HTTP_STATUS_OK : HTTP_STATUS_NO_CONTENT),
  );
}
