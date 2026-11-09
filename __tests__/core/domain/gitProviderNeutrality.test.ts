import type { GitUser } from '@/core/domain/GitUser';
import type { RepoRef } from '@/core/domain/RepoRef';

/**
 * These assertions are about the types, not the values: the point of the
 * neutral domain is that a provider other than GitLab can be expressed in it,
 * and TypeScript erases that at runtime. The guard is that this file compiles.
 */
describe('provider-neutral domain', () => {
  it('describes a user of a provider other than GitLab', () => {
    const githubUser: GitUser = { provider: 'github', username: 'octocat' };

    expect(githubUser.provider).toBe('github');
  });

  it('describes a repository of a provider other than GitLab', () => {
    const githubRepo: RepoRef = { provider: 'github', id: '1296269' };

    expect(githubRepo.provider).toBe('github');
  });

  it('still describes GitLab users and repositories', () => {
    const gitlabUser: GitUser = { provider: 'gitlab', username: 'tanuki' };
    const gitlabRepo: RepoRef = { provider: 'gitlab', id: '278964' };

    expect([gitlabUser.provider, gitlabRepo.provider]).toEqual([
      'gitlab',
      'gitlab',
    ]);
  });
});
