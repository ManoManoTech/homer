import { type ProviderType, toProviderType } from '@/core/typings/Provider';
import type { RepositoryProvider } from '@/core/typings/RepositoryProvider';
import githubUsers from '@root/config/homer/githubUsers.json';
import { GitHubProvider, type GithubUsersMapping } from './GitHubProvider';
import { GitLabProvider } from './GitLabProvider';

const providers: Partial<Record<ProviderType, RepositoryProvider>> = {};

export function getProvider(providerType: ProviderType): RepositoryProvider {
  // Rows and Slack values created before GitHub support have no provider.
  const type = toProviderType(providerType);
  let provider = providers[type];

  if (provider === undefined) {
    switch (type) {
      case 'gitlab':
        provider = new GitLabProvider();
        break;
      case 'github':
        provider = new GitHubProvider(githubUsers as GithubUsersMapping);
        break;
    }
    providers[type] = provider;
  }
  return provider;
}
