/**
 * Unit tests for GitLabProvider
 *
 * Tests the GitLab provider implementation that wraps existing GitLab
 * service functions and transforms data to unified models.
 */

import { GitLabProvider } from '@/core/services/providers/GitLabProvider';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type { GitlabMergeRequestDetails } from '@/core/typings/GitlabMergeRequest';
import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import type { GitlabUser } from '@/core/typings/GitlabUser';
import type {
  UnifiedCommit,
  UnifiedPipeline,
  UnifiedProject,
  UnifiedPullRequest,
  UnifiedUser,
} from '@/core/typings/UnifiedModels';
import { clearFetchMocks, mockFetch } from '@root/__mocks__/fetch-mock';

describe('GitLabProvider', () => {
  let provider: GitLabProvider;
  const GITLAB_URL = process.env.GITLAB_URL || 'https://my-git.domain.com';
  const GITLAB_TOKEN = process.env.GITLAB_TOKEN || 'GITLAB_TOKEN';
  const BASE_API_URL = `${GITLAB_URL}/api/v4`;

  /**
   * Helper to build the complete GitLab API URL with auth token
   * This matches how the gitlab service constructs URLs
   */
  const buildApiUrl = (path: string): string => {
    const separator = path.includes('?') ? '&' : '?';
    return `${BASE_API_URL}${path}${separator}private_token=${GITLAB_TOKEN}`;
  };

  beforeEach(() => {
    provider = new GitLabProvider(GITLAB_URL, GITLAB_TOKEN);
    jest.clearAllMocks();
    clearFetchMocks();
  });

  describe('Constructor and Type', () => {
    it('should create provider with correct type', () => {
      expect(provider.type).toBe('gitlab');
    });

    it('should be instantiated with URL and token', () => {
      expect(provider).toBeInstanceOf(GitLabProvider);
    });
  });

  describe('fetchPullRequest', () => {
    const projectId = 123;
    const iid = 100;

    const mockGitLabMR: GitlabMergeRequestDetails = {
      id: 999,
      iid: 100,
      title: 'Add feature X',
      description: 'This adds feature X',
      state: 'opened',
      web_url: `${GITLAB_URL}/org/repo/-/merge_requests/100`,
      source_branch: 'feature-x',
      target_branch: 'main',
      author: {
        id: 1,
        username: 'john.doe',
        name: 'John Doe',
        avatar_url: `${GITLAB_URL}/avatar.jpg`,
        state: 'active',
        web_url: `${GITLAB_URL}/john.doe`,
      },
      assignee: {
        id: 2,
        username: 'jane.doe',
        name: 'Jane Doe',
        avatar_url: null,
        state: 'active',
        web_url: `${GITLAB_URL}/jane.doe`,
      },
      assignees: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
      closed_at: null,
      closed_by: null,
      merge_status: 'can_be_merged',
      user_notes_count: 5,
      changes_count: '10',
      work_in_progress: false,
      labels: ['feature', 'backend'],
      project_id: projectId,
      references: {
        full: 'org/repo!100',
        relative: '!100',
        short: '!100',
      },
      sha: 'abc123',
      merge_commit_sha: null,
      squash: false,
      squash_commit_sha: null,
      allow_collaboration: false,
      allow_maintainer_to_push: false,
      discussion_locked: false,
      downvotes: 0,
      upvotes: 2,
      force_remove_source_branch: false,
      merge_when_pipeline_succeeds: false,
      should_remove_source_branch: true,
      source_project_id: projectId,
      target_project_id: projectId,
      milestone: {} as any,
      task_completion_status: { count: 0, completed_count: 0 },
      time_stats: {
        human_time_estimate: null,
        human_total_time_spent: null,
        time_estimate: 0,
        total_time_spent: 0,
      },
      blocking_discussions_resolved: true,
      diff_refs: {} as any,
      diverged_commits_count: 0,
      first_contribution: false,
      first_deployed_to_production_at: null,
      has_conflicts: false,
      head_pipeline: {
        id: 1,
        status: 'success',
        web_url: `${GITLAB_URL}/org/repo/-/pipelines/1`,
      },
      latest_build_finished_at: '2025-01-02T00:10:00Z',
      latest_build_started_at: '2025-01-02T00:00:00Z',
      merge_error: null,
      rebase_in_progress: false,
      subscribed: false,
    };

    it('should transform GitLab MR to UnifiedPullRequest', async () => {
      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]:
          mockGitLabMR,
      });

      const result = await provider.fetchPullRequest(projectId, iid);

      expect(result).toMatchObject<Partial<UnifiedPullRequest>>({
        type: 'gitlab',
        id: 999,
        iid: 100,
        title: 'Add feature X',
        description: 'This adds feature X',
        state: 'opened',
        webUrl: `${GITLAB_URL}/org/repo/-/merge_requests/100`,
        sourceBranch: 'feature-x',
        targetBranch: 'main',
        draft: false,
        mergeable: true,
        discussionCount: 5,
        changesCount: 10,
        projectId: 123,
        projectPath: 'org/repo',
        labels: ['feature', 'backend'],
      });

      expect(result.author).toMatchObject<UnifiedUser>({
        id: 1,
        username: 'john.doe',
        name: 'John Doe',
        avatarUrl: `${GITLAB_URL}/avatar.jpg`,
        webUrl: `${GITLAB_URL}/john.doe`,
      });

      expect(result.rawData).toBe(mockGitLabMR);
    });

    it('should handle merged merge request', async () => {
      const mergedMR = {
        ...mockGitLabMR,
        state: 'merged',
        merged_at: '2025-01-03T00:00:00Z',
        merge_status: 'merged',
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]: mergedMR,
      });

      const result = await provider.fetchPullRequest(projectId, iid);

      expect(result.state).toBe('merged');
      expect(result.mergedAt).toBe('2025-01-03T00:00:00Z');
      expect(result.mergeable).toBe(false);
    });

    it('should handle closed merge request', async () => {
      const closedMR = {
        ...mockGitLabMR,
        state: 'closed',
        closed_at: '2025-01-03T00:00:00Z',
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]: closedMR,
      });

      const result = await provider.fetchPullRequest(projectId, iid);

      expect(result.state).toBe('closed');
      expect(result.closedAt).toBe('2025-01-03T00:00:00Z');
    });

    it('should handle WIP/draft merge request', async () => {
      const draftMR = {
        ...mockGitLabMR,
        work_in_progress: true,
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]: draftMR,
      });

      const result = await provider.fetchPullRequest(projectId, iid);

      expect(result.draft).toBe(true);
    });

    it('should handle merge request with cannot_be_merged status', async () => {
      const conflictedMR = {
        ...mockGitLabMR,
        merge_status: 'cannot_be_merged',
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]:
          conflictedMR,
      });

      const result = await provider.fetchPullRequest(projectId, iid);

      expect(result.mergeable).toBe(false);
    });

    it('should parse changes_count from string to number', async () => {
      const mrWithStringChanges = {
        ...mockGitLabMR,
        changes_count: '42',
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]:
          mrWithStringChanges,
      });

      const result = await provider.fetchPullRequest(projectId, iid);

      expect(result.changesCount).toBe(42);
    });
  });

  describe('searchPullRequests', () => {
    const projectId = 123;

    it('should search by text query', async () => {
      const query = 'feature';
      const mockMRs = [
        {
          id: 999,
          iid: 100,
          title: 'Add feature X',
          description: '',
          state: 'opened',
          web_url: `${GITLAB_URL}/org/repo/-/merge_requests/100`,
          source_branch: 'feature',
          target_branch: 'main',
          author: {
            id: 1,
            username: 'author',
            name: 'Author',
            avatar_url: null,
            state: 'active',
            web_url: `${GITLAB_URL}/author`,
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          closed_at: null,
          closed_by: null,
          merge_status: 'can_be_merged',
          user_notes_count: 0,
          work_in_progress: false,
          labels: [],
          project_id: projectId,
          references: { full: 'org/repo!100' },
        } as any,
      ];

      mockFetch({
        [buildApiUrl(
          `/projects/${projectId}/merge_requests?search=${query}&state=locked,opened,reopened`,
        )]: mockMRs,
      });

      const result = await provider.searchPullRequests([projectId], query);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('gitlab');
      expect(result[0].iid).toBe(100);
    });

    it('should search by merge request ID (!123)', async () => {
      const query = '!100';
      const mockMR = {
        id: 999,
        iid: 100,
        title: 'Test MR',
        description: '',
        state: 'opened',
        web_url: `${GITLAB_URL}/org/repo/-/merge_requests/100`,
        source_branch: 'feature',
        target_branch: 'main',
        author: {
          id: 1,
          username: 'author',
          name: 'Author',
          avatar_url: null,
          state: 'active',
          web_url: `${GITLAB_URL}/author`,
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        closed_at: null,
        closed_by: null,
        merge_status: 'can_be_merged',
        user_notes_count: 0,
        work_in_progress: false,
        labels: [],
        project_id: projectId,
        references: { full: 'org/repo!100' },
      } as any;

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/100`)]: mockMR,
      });

      const result = await provider.searchPullRequests([projectId], query);

      expect(result).toHaveLength(1);
      expect(result[0].iid).toBe(100);
    });

    it('should filter by states', async () => {
      const query = 'test';
      const mockMRs = [
        {
          id: 999,
          iid: 100,
          title: 'Test MR',
          description: '',
          state: 'opened',
          web_url: `${GITLAB_URL}/org/repo/-/merge_requests/100`,
          source_branch: 'test',
          target_branch: 'main',
          author: {
            id: 1,
            username: 'author',
            name: 'Author',
            avatar_url: null,
            state: 'active',
            web_url: `${GITLAB_URL}/author`,
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          closed_at: null,
          closed_by: null,
          merge_status: 'can_be_merged',
          user_notes_count: 0,
          work_in_progress: false,
          labels: [],
          project_id: projectId,
          references: { full: 'org/repo!100' },
        } as any,
      ];

      mockFetch({
        [buildApiUrl(
          `/projects/${projectId}/merge_requests?search=${query}&state=opened`,
        )]: mockMRs,
      });

      const result = await provider.searchPullRequests([projectId], query, [
        'opened',
      ]);

      expect(result).toHaveLength(1);
    });
  });

  describe('fetchApprovers', () => {
    it('should fetch and transform approvers', async () => {
      const projectId = 123;
      const iid = 100;
      const mockApprovals = {
        approved_by: [
          {
            user: {
              id: 1,
              username: 'approver1',
              name: 'Approver One',
              avatar_url: null,
              state: 'active',
              web_url: `${GITLAB_URL}/approver1`,
            },
          },
        ],
      } as any;

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}/approvals`)]:
          mockApprovals,
      });

      const result = await provider.fetchApprovers(projectId, iid);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject<UnifiedUser>({
        id: 1,
        username: 'approver1',
        name: 'Approver One',
        avatarUrl: undefined,
        webUrl: `${GITLAB_URL}/approver1`,
      });
    });
  });

  describe('fetchReviewers', () => {
    it('should fetch and transform reviewers', async () => {
      const projectId = 123;
      const iid = 100;
      const mockReviewers = [
        {
          user: {
            id: 2,
            username: 'reviewer1',
            name: 'Reviewer One',
            avatar_url: null,
            state: 'active',
            web_url: `${GITLAB_URL}/reviewer1`,
          } as GitlabUser,
        },
      ];

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}/reviewers`)]:
          mockReviewers,
      });

      const result = await provider.fetchReviewers(projectId, iid);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject<UnifiedUser>({
        id: 2,
        username: 'reviewer1',
        name: 'Reviewer One',
      });
    });
  });

  describe('fetchAssignees', () => {
    it('should fetch assignees from merge request details', async () => {
      const projectId = 123;
      const iid = 100;
      const mockMR = {
        iid: 100,
        assignees: [
          {
            id: 3,
            username: 'assignee1',
            name: 'Assignee One',
            avatar_url: null,
            state: 'active',
            web_url: `${GITLAB_URL}/assignee1`,
          },
        ],
      } as any;

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]: mockMR,
      });

      const result = await provider.fetchAssignees(projectId, iid);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('assignee1');
    });
  });

  describe('fetchUser', () => {
    it('should fetch and transform user', async () => {
      const userId = 123;
      const mockUser: GitlabUser = {
        id: userId,
        username: 'john.doe',
        name: 'John Doe',
        avatar_url: `${GITLAB_URL}/avatar.jpg`,
        state: 'active',
        web_url: `${GITLAB_URL}/john.doe`,
      };

      mockFetch({
        [buildApiUrl(`/users/${userId}`)]: mockUser,
      });

      const result = await provider.fetchUser(userId);

      expect(result).toMatchObject<UnifiedUser>({
        id: userId,
        username: 'john.doe',
        name: 'John Doe',
        avatarUrl: `${GITLAB_URL}/avatar.jpg`,
        webUrl: `${GITLAB_URL}/john.doe`,
      });
    });
  });

  describe('fetchCommits', () => {
    it('should fetch and transform commits', async () => {
      const projectId = 123;
      const iid = 100;
      const mockCommits: GitlabCommit[] = [
        {
          id: 'abc123def456',
          short_id: 'abc123d',
          title: 'Fix: resolve issue',
          message: 'Fix: resolve issue\n\nDetailed description',
          author_name: 'John Doe',
          author_email: 'john@example.com',
          authored_date: '2025-01-01T10:00:00Z',
          committer_name: 'John Doe',
          committer_email: 'john@example.com',
          committed_date: '2025-01-01T10:00:00Z',
          created_at: '2025-01-01T10:00:00Z',
          parent_ids: [],
          web_url: `${GITLAB_URL}/org/repo/-/commit/abc123def456`,
        },
      ];

      mockFetch({
        [buildApiUrl(
          `/projects/${projectId}/merge_requests/${iid}/commits?per_page=100`,
        )]: mockCommits,
      });

      const result = await provider.fetchCommits(projectId, iid);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject<Partial<UnifiedCommit>>({
        sha: 'abc123def456',
        shortSha: 'abc123d',
        title: 'Fix: resolve issue',
        message: 'Fix: resolve issue\n\nDetailed description',
        authoredDate: '2025-01-01T10:00:00Z',
        webUrl: `${GITLAB_URL}/org/repo/-/commit/abc123def456`,
      });
    });
  });

  describe('fetchPipelineStatus', () => {
    it('should fetch and transform pipeline', async () => {
      const projectId = 123;
      const ref = 'main';
      const mockPipelines: GitlabPipeline[] = [
        {
          id: 456,
          iid: 1,
          project_id: projectId,
          status: 'success',
          ref,
          sha: 'abc123',
          source: 'push',
          web_url: `${GITLAB_URL}/org/repo/-/pipelines/456`,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:05:00Z',
        },
      ];

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/pipelines?ref=${ref}`)]:
          mockPipelines,
      });

      const result = await provider.fetchPipelineStatus(projectId, ref);

      expect(result).toMatchObject<Partial<UnifiedPipeline>>({
        id: 456,
        status: 'success',
        ref,
        webUrl: `${GITLAB_URL}/org/repo/-/pipelines/456`,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:05:00Z',
      });
    });

    it('should return null when no pipelines found', async () => {
      const projectId = 123;
      const ref = 'main';

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/pipelines?ref=${ref}`)]: [],
      });

      const result = await provider.fetchPipelineStatus(projectId, ref);

      expect(result).toBeNull();
    });
  });

  describe('fetchProject', () => {
    it('should fetch and transform project', async () => {
      const projectId = 123;
      const mockProject: GitlabProjectDetails = {
        id: projectId,
        name: 'my-repo',
        path: 'my-repo',
        path_with_namespace: 'org/my-repo',
        web_url: `${GITLAB_URL}/org/my-repo`,
        default_branch: 'main',
        visibility: 'private',
        namespace: {
          id: 10,
          name: 'org',
          path: 'org',
          kind: 'group',
          full_path: 'org',
          avatar_url: '',
          web_url: `${GITLAB_URL}/org`,
        },
      } as GitlabProjectDetails;

      mockFetch({
        [buildApiUrl(`/projects/${projectId}`)]: mockProject,
      });

      const result = await provider.fetchProject(projectId);

      expect(result).toMatchObject<UnifiedProject>({
        id: projectId,
        name: 'my-repo',
        path: 'my-repo',
        pathWithNamespace: 'org/my-repo',
        webUrl: `${GITLAB_URL}/org/my-repo`,
        defaultBranch: 'main',
      });
    });
  });

  describe('triggerPipeline', () => {
    it('should trigger pipeline for ref', async () => {
      const projectId = 123;
      const ref = 'feature-branch';
      const mockPipeline = {
        id: 456,
        status: 'pending',
        ref,
        created_at: '2025-01-01T00:00:00Z',
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/pipeline`)]: mockPipeline,
      });

      await expect(
        provider.triggerPipeline(projectId, ref),
      ).resolves.not.toThrow();
    });
  });

  describe('rebasePullRequest', () => {
    it('should trigger rebase for merge request', async () => {
      const projectId = 123;
      const iid = 100;
      const mockResponse = { rebase_in_progress: true };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}/rebase`)]:
          mockResponse,
      });

      await expect(
        provider.rebasePullRequest(projectId, iid),
      ).resolves.not.toThrow();
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate GitLab webhook token', () => {
      const payload = Buffer.from('{"object_kind":"merge_request"}');
      const secret = 'test-secret';
      const signature = 'test-secret';

      const isValid = provider.validateWebhookSignature(
        payload,
        signature,
        secret,
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid token', () => {
      const payload = Buffer.from('{"object_kind":"merge_request"}');
      const secret = 'test-secret';
      const signature = 'wrong-secret';

      const isValid = provider.validateWebhookSignature(
        payload,
        signature,
        secret,
      );

      expect(isValid).toBe(false);
    });
  });

  describe('parseWebhookEvent', () => {
    it('should parse merge_request webhook', () => {
      const headers = { 'x-gitlab-event': 'Merge Request Hook' };
      const body = {
        object_kind: 'merge_request',
        object_attributes: {
          action: 'open',
          id: 999,
          iid: 100,
          project_id: 123,
        },
      };

      const result = provider.parseWebhookEvent(headers, body);

      expect(result).toBeDefined();
      expect(result?.type).toBe('pull_request');
      expect(result?.action).toBe('open');
    });

    it('should parse note webhook', () => {
      const headers = { 'x-gitlab-event': 'Note Hook' };
      const body = {
        object_kind: 'note',
        merge_request: { iid: 100 },
        project: { id: 123 },
      };

      const result = provider.parseWebhookEvent(headers, body);

      expect(result).toBeDefined();
      expect(result?.type).toBe('note');
    });

    it('should parse push webhook', () => {
      const headers = { 'x-gitlab-event': 'Push Hook' };
      const body = {
        object_kind: 'push',
        ref: 'refs/heads/main',
        project_id: 123,
      };

      const result = provider.parseWebhookEvent(headers, body);

      expect(result).toBeDefined();
      expect(result?.type).toBe('push');
    });

    it('should return null for unknown webhook', () => {
      const headers = { 'x-gitlab-event': 'Unknown Hook' };
      const body = { object_kind: 'unknown' };

      const result = provider.parseWebhookEvent(headers, body);

      expect(result).toBeNull();
    });
  });
});
