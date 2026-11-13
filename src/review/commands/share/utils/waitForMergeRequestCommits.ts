import { logger } from '@/core/services/logger';
import type { RepositoryProvider } from '@/core/typings/RepositoryProvider';

const TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 1000;

/**
 * Providers update merge request commits asynchronously after a push, so the
 * pushed commits may not be listed yet.
 *
 * @returns the commit ids of the merge request.
 */
export async function waitForMergeRequestCommits(
  provider: Pick<RepositoryProvider, 'fetchPullRequestCommitIds'>,
  projectId: number,
  mergeRequestIid: number,
  pushedCommitIds: Set<string>,
): Promise<string[]> {
  let timeoutReached = false;
  let lastCommitIds: string[] = [];

  const timeout = setTimeout(() => {
    logger.warn(
      `Pushed commits not found in MR !${mergeRequestIid} of project ${projectId} after ${TIMEOUT_MS}ms`,
    );
    timeoutReached = true;
  }, TIMEOUT_MS);

  while (!timeoutReached) {
    try {
      const commitIds = await provider.fetchPullRequestCommitIds(
        projectId,
        mergeRequestIid,
      );
      if (Array.isArray(commitIds)) {
        lastCommitIds = commitIds;
        if (lastCommitIds.some((id) => pushedCommitIds.has(id))) {
          clearTimeout(timeout);
          return lastCommitIds;
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to fetch commits for MR !${mergeRequestIid} of project ${projectId}: ${error instanceof Error ? error.message : error}`,
      );
    }
    await new Promise((resolve) => {
      setTimeout(resolve, RETRY_DELAY_MS);
    });
  }

  return lastCommitIds;
}
