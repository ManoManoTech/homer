import { CONFIG } from '@/config';
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

  const results = await Promise.all(
    [...projectIdsByProvider].map(([provider, projectIds]) =>
      getProvider(provider).searchPullRequests(query, projectIds),
    ),
  );
  return results.flat();
}
