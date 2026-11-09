import { CONFIG } from '@/config';
import { logger } from '@/core/services/logger';
import type { DataProject } from '@/core/typings/Data';
import type { ProviderType } from '@/core/typings/Provider';
import type { UnifiedPullRequest } from '@/core/typings/UnifiedModels';
import { getProvider } from './ProviderFactory';

/**
 * Searches open pull requests among the given projects, whatever their
 * provider.
 */
export async function searchPullRequests(
  query: string,
  projects: DataProject[],
): Promise<UnifiedPullRequest[]> {
  const projectIdsByProvider = new Map<ProviderType, number[]>();
  const isUrl = /^https?:\/\//.test(query);

  // A URL is enough to find the pull request, even outside channel projects.
  if (isUrl) {
    projectIdsByProvider.set(
      query.startsWith(`${CONFIG.github.url}/`) ? 'github' : 'gitlab',
      [],
    );
  }

  for (const { projectId, provider } of projects) {
    if (!isUrl || projectIdsByProvider.has(provider)) {
      projectIdsByProvider.set(provider, [
        ...(projectIdsByProvider.get(provider) ?? []),
        projectId,
      ]);
    }
  }

  const providers = [...projectIdsByProvider];
  const results = await Promise.allSettled(
    providers.map(([provider, projectIds]) =>
      getProvider(provider).searchPullRequests(query, projectIds),
    ),
  );

  // One provider failing must not hide the results of the others.
  const pullRequests: UnifiedPullRequest[] = [];
  const errors: unknown[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      pullRequests.push(...result.value);
    } else {
      errors.push(result.reason);
      logger.warn(
        { error: result.reason, provider: providers[index][0] },
        'Could not search pull requests',
      );
    }
  });

  if (errors.length > 0 && errors.length === results.length) {
    throw errors[0];
  }
  return pullRequests;
}
