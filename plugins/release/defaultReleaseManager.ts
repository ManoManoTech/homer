import type { DataRelease } from '@/core/typings/Data';
import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import type {
  ReleaseManager,
  ReleaseOptions,
} from '@/release/typings/ReleaseManager';
import type { ReleaseStateUpdate } from '@/release/typings/ReleaseStateUpdate';

const dockerBuildJobNames = [
  'Build Image',
  'Build with KO',
  'build-application',
  'build_ecs_image',
  'build_image',
];

async function getReleaseStateUpdate(
  { failedDeployments, state, successfulDeployments }: DataRelease,
  deploymentHook?: GitlabDeploymentHook,
): Promise<ReleaseStateUpdate[]> {
  if (deploymentHook === undefined) {
    const isProductionEnvironment = successfulDeployments.some((env) =>
      env.environment.startsWith('production'),
    );
    return isProductionEnvironment && state === 'monitoring'
      ? [{ deploymentState: 'completed', environment: 'production' }]
      : [];
  }

  const { environment, status } = deploymentHook;

  if (environment.startsWith('staging')) {
    switch (status) {
      case 'failed':
        return [{ deploymentState: 'failed', environment: 'staging' }];

      case 'running':
        return [{ deploymentState: 'deploying', environment: 'staging' }];

      case 'success':
        return [{ deploymentState: 'monitoring', environment: 'staging' }];

      default:
        throw new Error(`Unhandled staging deployment status: ${status}`);
    }
  } else if (environment.startsWith('production')) {
    switch (status) {
      case 'failed':
        return [{ deploymentState: 'failed', environment: 'production' }];

      case 'running':
        return failedDeployments.length === 0
          ? [
              { deploymentState: 'completed', environment: 'staging' },
              { deploymentState: 'deploying', environment: 'production' },
            ]
          : [{ deploymentState: 'deploying', environment: 'production' }];

      case 'success':
        return [{ deploymentState: 'monitoring', environment: 'production' }];

      default:
        throw new Error(`Unhandled production deployment status: ${status}`);
    }
  } else if (environment.startsWith('support')) {
    switch (status) {
      case 'failed':
        return [{ deploymentState: 'failed', environment: 'support' }];

      case 'running':
        return [{ deploymentState: 'deploying', environment: 'support' }];

      case 'success':
        return [{ deploymentState: 'completed', environment: 'support' }];

      default:
        throw new Error(`Unhandled support deployment status: ${status}`);
    }
  }
  return [];
}

async function isReadyToRelease(
  { projectId }: DataRelease,
  mainBranchPipelineId: number,
  { gitlab: { fetchPipelineJobs } }: ReleaseOptions,
) {
  const pipelinesJobs = await fetchPipelineJobs(
    projectId,
    mainBranchPipelineId,
  );
  const dockerBuildJob = pipelinesJobs.find((job) =>
    dockerBuildJobNames.includes(job.name),
  );
  return dockerBuildJob?.status === 'success';
}

const defaultReleaseManager: ReleaseManager = {
  getReleaseStateUpdate,
  isReadyToRelease,
};

export default defaultReleaseManager;
