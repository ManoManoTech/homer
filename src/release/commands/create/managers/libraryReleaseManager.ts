import { fetchPipelineJobs } from '@/core/services/gitlab';
import type { DataRelease } from '@/core/typings/Data';
import type { ReleaseManager } from '../../../typings/ReleaseManager';
import type { ReleaseStateUpdate } from '../../../typings/ReleaseStateUpdate';

const buildJobNames = ['goreleaser-build-snapshot'];

async function getReleaseStateUpdate(): Promise<ReleaseStateUpdate[]> {
  return [];
}

export async function isReadyToRelease(
  { projectId }: DataRelease,
  mainBranchPipelineId: number
) {
  const pipelinesJobs = await fetchPipelineJobs(
    projectId,
    mainBranchPipelineId
  );
  const buildJob = pipelinesJobs.find((job) =>
    buildJobNames.includes(job.name)
  );
  return buildJob?.status === 'success';
}

export const libraryReleaseManager: ReleaseManager = {
  getReleaseStateUpdate,
  isReadyToRelease,
};
