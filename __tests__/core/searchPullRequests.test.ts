import { getProvider } from '@/core/services/providers/ProviderFactory';
import { searchPullRequests } from '@/core/services/providers/searchPullRequests';
import type { ProviderType } from '@/core/typings/Provider';
import type { UnifiedPullRequest } from '@/core/typings/UnifiedModels';

jest.mock('@/core/services/providers/ProviderFactory', () => ({
  getProvider: jest.fn(),
}));

const gitlabPullRequest = { iid: 1, provider: 'gitlab' } as UnifiedPullRequest;
const projects = [
  { channelId: 'channelId', projectId: 1, provider: 'gitlab' as const },
  { channelId: 'channelId', projectId: 2, provider: 'github' as const },
];

function mockSearches(
  searches: Record<ProviderType, () => Promise<UnifiedPullRequest[]>>,
) {
  (getProvider as jest.Mock).mockImplementation((provider: ProviderType) => ({
    searchPullRequests: searches[provider],
  }));
}

describe('searchPullRequests', () => {
  it('should return the results of the other providers when one fails', async () => {
    // Given
    mockSearches({
      github: () => Promise.reject(new Error('GitHub is down')),
      gitlab: () => Promise.resolve([gitlabPullRequest]),
    });

    // When
    const pullRequests = await searchPullRequests('query', projects);

    // Then
    expect(pullRequests).toEqual([gitlabPullRequest]);
  });

  it('should fail when every provider fails', async () => {
    // Given
    mockSearches({
      github: () => Promise.reject(new Error('GitHub is down')),
      gitlab: () => Promise.reject(new Error('GitLab is down')),
    });

    // When
    const search = searchPullRequests('query', projects);

    // Then
    await expect(search).rejects.toThrow(/is down/);
  });
});
