import { fetchPipelinesByRef } from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';

const PIPELINE_RETRIEVE_TIMEOUT = 30000;
const DELAY_BETWEEN_PIPELINE_RETRIEVES = 2000;

export async function waitForReleasePipeline(
  projectId: number,
  releaseTagName: string
): Promise<GitlabPipeline | undefined> {
  let pipeline: GitlabPipeline | undefined;
  let timeoutReached = false;

  const timeout = setTimeout(() => {
    logger.error(
      `Unable to retrieve pipeline for release ${releaseTagName} of project ${projectId}`
    );
    timeoutReached = true;
  }, PIPELINE_RETRIEVE_TIMEOUT);

  while (!timeoutReached) {
    const pipelines = await fetchPipelinesByRef(projectId, releaseTagName);

    if (pipelines.length > 0) {
      clearTimeout(timeout);
      [pipeline] = pipelines;
      break;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, DELAY_BETWEEN_PIPELINE_RETRIEVES);
    });
  }
  return pipeline;
}
