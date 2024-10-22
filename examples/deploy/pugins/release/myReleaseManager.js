Object.defineProperty(exports, '__esModule', { value: true });
const jobsToCheckBeforeRelease = ['Build Image'];
async function getReleaseStateUpdate(
  { failedDeployments, state, successfulDeployments },
  deploymentHook
) {
  if (deploymentHook === undefined) {
    const isProductionEnvironment = successfulDeployments.some((env) =>
      env.startsWith('production')
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
  }
  return [];
}
async function isReadyToRelease(
  { projectId },
  mainBranchPipelineId,
  { gitlab: { fetchPipelineJobs } }
) {
  const pipelinesJobs = await fetchPipelineJobs(
    projectId,
    mainBranchPipelineId
  );
  const buildJob = pipelinesJobs.find((job) =>
    jobsToCheckBeforeRelease.includes(job.name)
  );
  return buildJob?.status === 'success';
}
const myReleaseManager = {
  getReleaseStateUpdate,
  isReadyToRelease,
};
exports.default = myReleaseManager;
