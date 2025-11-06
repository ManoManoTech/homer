import { generateChangelog } from '@/changelog/utils/generateChangelog';
import * as gitlab from '@/core/services/gitlab';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';

jest.mock('@/core/services/gitlab', () => ({
  fetchMergeRequestByIid: jest.fn(),
  fetchMergeRequestCommits: jest.fn(),
  fetchProjectCommit: jest.fn(),
  fetchProjectCommits: jest.fn(),
  fetchProjectCommitsSince: jest.fn(),
  fetchProjectTag: jest.fn(),
}));

describe('generateChangelog', () => {
  const baseCommit = (overrides: Partial<GitlabCommit> = {}): GitlabCommit => ({
    author_email: 'dev@example.com',
    author_name: 'Dev',
    authored_date: new Date('2025-01-01T00:00:00Z').toISOString(),
    committed_date: new Date('2025-01-01T00:00:00Z').toISOString(),
    committer_email: 'dev@example.com',
    committer_name: 'Dev',
    created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
    id: 'sha',
    message: 'feat: something',
    parent_ids: [],
    short_id: 'sha',
    title: 'feat: something',
    web_url: 'https://gitlab.example.com/commit/sha',
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns simple list when there are no merge commits into default branches', async () => {
    const commits: GitlabCommit[] = [
      baseCommit({
        id: 'c1',
        short_id: 'c1',
        title: 'feat(core): add feature',
        message: 'feat(core): add feature ABC-123',
        created_at: '2025-01-01T10:00:00Z',
      }),
      baseCommit({
        id: 'c2',
        short_id: 'c2',
        title: 'chore: update docs',
        message: 'chore: update docs',
        created_at: '2025-01-01T11:00:00Z',
      }),
    ];

    (gitlab.fetchProjectCommits as jest.Mock).mockResolvedValue(commits);

    const result = await generateChangelog(1, undefined);

    expect(gitlab.fetchProjectCommits as jest.Mock).toHaveBeenCalledWith(1);
    expect(result).toBe(
      [
        '- feat(core): add feature - [ABC-123](https://my-ticket-management.com/view/ABC-123)',
        '- chore: update docs',
      ].join('\n'),
    );
  });

  it('uses commits since previous tag when previousReleaseTagName is provided', async () => {
    (gitlab.fetchProjectTag as jest.Mock).mockResolvedValue({
      commit: { created_at: '2025-01-01T12:00:00Z' },
    });

    // No merge commits again → simple list
    const commits: GitlabCommit[] = [
      baseCommit({
        id: 'c3',
        short_id: 'c3',
        title: 'fix: bug',
        message: 'fix: bug XYZ-7',
        created_at: '2025-01-02T12:00:01Z',
      }),
    ];

    (gitlab.fetchProjectCommitsSince as jest.Mock).mockResolvedValue(commits);

    const result = await generateChangelog(2, 'v1.2.3');

    expect(gitlab.fetchProjectTag as jest.Mock).toHaveBeenCalledWith(
      2,
      'v1.2.3',
    );
    expect(gitlab.fetchProjectCommitsSince as jest.Mock).toHaveBeenCalledTimes(
      1,
    );
    // second arg is ISO string greater than tag created_at by ~1s
    const sinceArg = (gitlab.fetchProjectCommitsSince as jest.Mock).mock
      .calls[0][1];
    expect(typeof sinceArg).toBe('string');

    expect(result).toBe(
      '- fix: bug - [XYZ-7](https://my-ticket-management.com/view/XYZ-7)',
    );
  });

  it('maps merge commits (squash) to MR link with ticket', async () => {
    const mergeCommit = baseCommit({
      id: 'm1',
      short_id: 'm1',
      title: "Merge branch 'feature' into 'main'",
      message:
        "Merge branch 'feature' into 'main'\n\nSee merge request group/proj!42",
      created_at: '2025-01-03T09:00:00Z',
    });

    (gitlab.fetchProjectCommits as jest.Mock).mockResolvedValue([
      mergeCommit,
      baseCommit({ id: 'c4', short_id: 'c4' }),
    ]);

    (gitlab.fetchMergeRequestByIid as jest.Mock).mockResolvedValue({
      web_url: 'https://gitlab.example.com/group/proj/-/merge_requests/42',
      squash: true,
      squash_commit_sha: 'squashsha',
    });

    (gitlab.fetchProjectCommit as jest.Mock).mockResolvedValue(
      baseCommit({
        id: 'squashsha',
        short_id: 'squashsha',
        title: 'feat: implement super thing',
        message: 'feat: implement super thing ABC-9',
        created_at: '2025-01-03T09:00:01Z',
      }),
    );

    const result = await generateChangelog(3, undefined);

    expect(gitlab.fetchMergeRequestByIid as jest.Mock).toHaveBeenCalledWith(
      3,
      42,
    );
    expect(gitlab.fetchProjectCommit as jest.Mock).toHaveBeenCalledWith(
      3,
      'squashsha',
    );
    expect(result).toBe(
      '- [feat: implement super thing](https://gitlab.example.com/group/proj/-/merge_requests/42) - [ABC-9](https://my-ticket-management.com/view/ABC-9)',
    );
  });

  it('removes duplicated commits keeping the oldest created_at', async () => {
    const mergeCommit1 = baseCommit({
      id: 'mA',
      short_id: 'mA',
      title: "Merge branch 'feature' into 'main'",
      message:
        "Merge branch 'feature' into 'main'\n\nSee merge request group/proj!10",
      created_at: '2025-01-04T10:00:00Z',
    });
    const mergeCommit2 = baseCommit({
      id: 'mB',
      short_id: 'mB',
      title: "Merge branch 'feature' into 'release'",
      message:
        "Merge branch 'feature' into 'release'\n\nSee merge request group/proj!11",
      created_at: '2025-01-04T11:00:00Z',
    });

    (gitlab.fetchProjectCommits as jest.Mock).mockResolvedValue([
      mergeCommit1,
      mergeCommit2,
    ]);

    // Both MRs point to commits with the same message but different created_at
    (gitlab.fetchMergeRequestByIid as jest.Mock)
      .mockResolvedValueOnce({
        web_url: 'https://gitlab.example.com/group/proj/-/merge_requests/10',
        squash: true,
        squash_commit_sha: 'sha10',
      })
      .mockResolvedValueOnce({
        web_url: 'https://gitlab.example.com/group/proj/-/merge_requests/11',
        squash: true,
        squash_commit_sha: 'sha11',
      });

    const sharedMessage = 'feat: shared change TKT-55';

    (gitlab.fetchProjectCommit as jest.Mock)
      .mockResolvedValueOnce(
        baseCommit({
          id: 'sha10',
          short_id: 'sha10',
          title: 'feat: shared change',
          message: sharedMessage,
          created_at: '2025-01-01T09:00:00Z', // oldest
        }),
      )
      .mockResolvedValueOnce(
        baseCommit({
          id: 'sha11',
          short_id: 'sha11',
          title: 'feat: shared change',
          message: sharedMessage,
          created_at: '2025-01-02T09:00:00Z', // newer
        }),
      );

    const result = await generateChangelog(4, undefined);

    // Should keep only the oldest one (sha10)
    expect(result).toBe(
      '- [feat: shared change](https://gitlab.example.com/group/proj/-/merge_requests/10) - [TKT-55](https://my-ticket-management.com/view/TKT-55)',
    );
  });
});
