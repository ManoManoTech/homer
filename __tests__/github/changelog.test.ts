import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { mockUrl } from '@root/__mocks__/fetch-mock';
import { githubRepositoryFixture } from '../__fixtures__/github/repositoryFixture';
import { mockGithubCall } from '../utils/mockGithubCall';

const { full_name, html_url, id: projectId } = githubRepositoryFixture;
const repo = `/repos/${full_name}`;

function commit(sha: string, message: string) {
  return {
    sha,
    html_url: `${html_url}/commit/${sha}`,
    commit: {
      message,
      author: { name: 'a', email: 'a@b.c', date: '2026-01-01T00:00:00Z' },
      committer: { name: 'a', email: 'a@b.c', date: '2026-01-01T00:00:00Z' },
    },
  };
}

describe('github > changelog', () => {
  beforeEach(() => {
    mockGithubCall(`/repositories/${projectId}`, githubRepositoryFixture);
  });

  it('should list tags from the newest tagged commit', async () => {
    // Given
    mockUrl('https://github.my-git.domain.com/api/graphql', {
      data: {
        repository: {
          refs: {
            nodes: [
              { name: 'v2.0.0', target: { committedDate: '2026-02-01' } },
              {
                name: 'v1.0.0',
                target: { target: { committedDate: '2026-01-01' } },
              },
            ],
          },
        },
      },
    });

    // When
    const tags = await getProvider('github').fetchTags(projectId);

    // Then
    expect(tags).toEqual([
      { name: 'v2.0.0', commitDate: '2026-02-01' },
      { name: 'v1.0.0', commitDate: '2026-01-01' },
    ]);
  });

  it('should group commits by pull request since the previous tag', async () => {
    // Given
    mockGithubCall(`${repo}/compare/v1.0.0...main?per_page=100&page=1`, {
      commits: [
        commit('c1', 'feat: first'),
        commit('c2', 'fix: second'),
        commit(
          'm1',
          'Merge pull request #3 from homer-org/feat\n\nfeat: merged',
        ),
        commit('s1', 'feat: squashed JIRA-12 (#4)\n\n* details'),
        commit('d1', 'chore: direct push'),
      ],
    });
    mockGithubCall(`${repo}/pulls/3/commits?per_page=100`, [
      commit('c1', 'feat: first'),
      commit('c2', 'fix: second'),
    ]);

    // When
    const changelog = await generateChangelog(
      projectId,
      'v1.0.0',
      ({ title }) => !title.startsWith('fix'),
      'github',
    );

    // Then
    expect(changelog).toEqual(
      [
        `- [feat: first](${html_url}/pull/3)`,
        `- [feat: squashed JIRA-12](${html_url}/pull/4) - [JIRA-12](https://my-ticket-management.com/view/JIRA-12)`,
      ].join('\n'),
    );
  });

  it('should list commits when none comes from a pull request', async () => {
    // Given
    mockGithubCall(`${repo}/commits?sha=main&per_page=100`, [
      commit('c2', 'feat: second'),
      commit('c1', 'feat: first'),
    ]);

    // When
    const changelog = await generateChangelog(
      projectId,
      undefined,
      undefined,
      'github',
    );

    // Then
    expect(changelog).toEqual('- feat: second\n- feat: first');
  });
});
