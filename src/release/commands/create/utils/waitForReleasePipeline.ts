import { logger } from '@/core/services/logger';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { DEFAULT_PROVIDER, type ProviderType } from '@/core/typings/Provider';
import type { UnifiedPipeline } from '@/core/typings/UnifiedModels';

const PIPELINE_RETRIEVE_TIMEOUT = 30000;
const DELAY_BETWEEN_PIPELINE_RETRIEVES = 2000;

export async function waitForReleasePipeline(
  projectId: number,
  releaseTagName: string,
  provider: ProviderType = DEFAULT_PROVIDER,
): Promise<UnifiedPipeline | undefined> {
  let pipeline: UnifiedPipeline | undefined;
  let timeoutReached = false;

  const timeout = setTimeout(() => {
    logger.error(
      `Unable to retrieve pipeline for release ${releaseTagName} of project ${projectId}`,
    );
    timeoutReached = true;
  }, PIPELINE_RETRIEVE_TIMEOUT);

  while (!timeoutReached) {
    const pipelines = await getProvider(provider).fetchPipelinesByRef(
      projectId,
      releaseTagName,
    );

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
