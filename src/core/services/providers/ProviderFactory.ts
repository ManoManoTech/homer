import { type ProviderType, toProviderType } from '@/core/typings/Provider';
import type { RepositoryProvider } from '@/core/typings/RepositoryProvider';
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
        throw new Error('GitHub provider is not available yet');
    }
    providers[type] = provider;
  }
  return provider;
}
