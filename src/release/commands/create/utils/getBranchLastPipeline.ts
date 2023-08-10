import { fetchBranchPipelines } from '@/core/services/gitlab';
import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';

export async function getBranchLastPipeline(
  projectId: number,
  branchName: string
): Promise<GitlabPipeline> {
  const branchPipelines = await fetchBranchPipelines(projectId, branchName);

  const lastPipeline = branchPipelines.find(
    (pipeline) =>
      pipeline.status !== 'canceled' && pipeline.source !== 'schedule'
  );

  if (lastPipeline === undefined) {
    throw new Error(`Unable to find a non cancelled ${branchName} pipeline`);
  }
  return lastPipeline;
}
