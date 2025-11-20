/**
 * Regression tests for GitLab review-related functions
 *
 * These tests ensure that the core GitLab API functions used in the review
 * workflow continue to work correctly before we introduce the provider abstraction.
 */

import {
  fetchMergeRequestApprovers,
  fetchMergeRequestByIid,
  fetchMergeRequestCommits,
  fetchProjectById,
  fetchReviewers,
  fetchUserById,
  rebaseMergeRequest,
  runPipeline,
  searchMergeRequests,
} from '@/core/services/gitlab';
import type { GitlabApprovalsResponse } from '@/core/typings/GitlabApprovalsResponse';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type {
  GitlabMergeRequest,
  GitlabMergeRequestDetails,
} from '@/core/typings/GitlabMergeRequest';
import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import type { GitlabUser } from '@/core/typings/GitlabUser';
import { mockFetch } from '@root/__mocks__/fetch-mock';

describe('GitLab Review Functions - Regression Tests', () => {
  const GITLAB_URL = process.env.GITLAB_URL || 'https://my-git.domain.com';
  const GITLAB_TOKEN = process.env.GITLAB_TOKEN || 'GITLAB_TOKEN';
  const BASE_API_URL = `${GITLAB_URL}/api/v4`;

  /**
   * Helper to build the complete GitLab API URL with auth token
   */
  const buildApiUrl = (path: string): string => {
    const separator = path.includes('?') ? '&' : '?';
    return `${BASE_API_URL}${path}${separator}private_token=${GITLAB_TOKEN}`;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchMergeRequestByIid', () => {
    it('should fetch merge request details by project ID and IID', async () => {
      const projectId = 123;
      const iid = 100;
      const mockMR: GitlabMergeRequestDetails = {
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
          avatar_url: null,
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
        merged_at: undefined,
        merge_status: 'can_be_merged',
        user_notes_count: 5,
        changes_count: '10',
        work_in_progress: false,
        labels: ['feature'],
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

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]: mockMR,
      });

      const result = await fetchMergeRequestByIid(projectId, iid);

      expect(result).toEqual(mockMR);
      expect(result.iid).toBe(iid);
      expect(result.title).toBe('Add feature X');
      expect(result.state).toBe('opened');
    });

    it('should handle merge request with merged state', async () => {
      const projectId = 123;
      const iid = 100;
      const mockMR: Partial<GitlabMergeRequestDetails> = {
        id: 999,
        iid: 100,
        state: 'merged',
        merged_at: '2025-01-03T00:00:00Z',
        merge_status: 'merged',
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]: mockMR,
      });

      const result = await fetchMergeRequestByIid(projectId, iid);

      expect(result.state).toBe('merged');
      expect(result.merged_at).toBeDefined();
    });
  });

  describe('fetchMergeRequestApprovers', () => {
    it('should fetch approvers for a merge request', async () => {
      const projectId = 123;
      const iid = 100;
      const mockApprovals: GitlabApprovalsResponse = {
        id: 999,
        iid: 100,
        project_id: projectId,
        title: 'Test MR',
        description: '',
        state: 'opened',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        merge_status: 'can_be_merged',
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
          {
            user: {
              id: 2,
              username: 'approver2',
              name: 'Approver Two',
              avatar_url: null,
              state: 'active',
              web_url: `${GITLAB_URL}/approver2`,
            },
          },
        ],
        approvals_left: 0,
        approvals_required: 2,
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}/approvals`)]:
          mockApprovals,
      });

      const result = await fetchMergeRequestApprovers(projectId, iid);

      expect(result.approvers).toHaveLength(2);
      expect(result.approvers[0].username).toBe('approver1');
      expect(result.approvers[1].username).toBe('approver2');
    });

    it('should return empty array when no approvers', async () => {
      const projectId = 123;
      const iid = 100;
      const mockApprovals: GitlabApprovalsResponse = {
        id: 999,
        iid: 100,
        project_id: projectId,
        title: 'Test MR',
        description: '',
        state: 'opened',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        merge_status: 'can_be_merged',
        approved_by: [],
        approvals_left: 2,
        approvals_required: 2,
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}/approvals`)]:
          mockApprovals,
      });

      const result = await fetchMergeRequestApprovers(projectId, iid);

      expect(result.approvers).toHaveLength(0);
    });
  });

  describe('fetchReviewers', () => {
    it('should fetch reviewers for a merge request', async () => {
      const projectId = 123;
      const iid = 100;
      const mockReviewers = [
        {
          user: {
            id: 1,
            username: 'reviewer1',
            name: 'Reviewer One',
            avatar_url: null,
            state: 'active',
            web_url: `${GITLAB_URL}/reviewer1`,
          } as GitlabUser,
        },
        {
          user: {
            id: 2,
            username: 'reviewer2',
            name: 'Reviewer Two',
            avatar_url: null,
            state: 'active',
            web_url: `${GITLAB_URL}/reviewer2`,
          } as GitlabUser,
        },
      ];

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}/reviewers`)]:
          mockReviewers,
      });

      const result = await fetchReviewers(projectId, iid);

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('reviewer1');
      expect(result[1].username).toBe('reviewer2');
    });
  });

  describe('fetchMergeRequestCommits', () => {
    it('should fetch commits for a merge request', async () => {
      const projectId = 123;
      const iid = 100;
      const mockCommits: GitlabCommit[] = [
        {
          id: 'abc123',
          short_id: 'abc123d',
          title: 'Fix: resolve login issue',
          message: 'Fix: resolve login issue\n\nDetailed description',
          author_name: 'John Doe',
          author_email: 'john@example.com',
          authored_date: '2025-01-01T10:00:00Z',
          committer_name: 'John Doe',
          committer_email: 'john@example.com',
          committed_date: '2025-01-01T10:00:00Z',
          created_at: '2025-01-01T10:00:00Z',
          parent_ids: [],
          web_url: `${GITLAB_URL}/org/repo/-/commit/abc123`,
        },
      ];

      mockFetch({
        [buildApiUrl(
          `/projects/${projectId}/merge_requests/${iid}/commits?per_page=100`,
        )]: mockCommits,
      });

      const result = await fetchMergeRequestCommits(projectId, iid);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('abc123');
      expect(result[0].title).toBe('Fix: resolve login issue');
    });
  });

  describe('fetchProjectById', () => {
    it('should fetch project details', async () => {
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

      const result = await fetchProjectById(projectId);

      expect(result.id).toBe(projectId);
      expect(result.name).toBe('my-repo');
      expect(result.path_with_namespace).toBe('org/my-repo');
    });
  });

  describe('fetchUserById', () => {
    it('should fetch user details', async () => {
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

      const result = await fetchUserById(userId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(userId);
      expect(result!.username).toBe('john.doe');
      expect(result!.name).toBe('John Doe');
    });
  });

  describe('searchMergeRequests', () => {
    it('should search merge requests by text query', async () => {
      const projectId = 123;
      const query = 'feature';
      const projects = [
        { projectId, channelId: 'C123', providerType: 'gitlab' as const },
      ];
      const mockMRs: GitlabMergeRequest[] = [
        {
          id: 999,
          iid: 100,
          title: 'Add feature X',
          description: 'Description',
          state: 'opened',
          web_url: `${GITLAB_URL}/org/repo/-/merge_requests/100`,
          source_branch: 'feature-x',
          target_branch: 'main',
          author: {} as GitlabUser,
          assignee: {} as GitlabUser,
          assignees: [],
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          closed_at: null,
          closed_by: null,
          merge_status: 'can_be_merged',
          user_notes_count: 5,
          work_in_progress: false,
          labels: ['feature'],
          project_id: projectId,
          references: {} as any,
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
          time_stats: {} as any,
        },
      ];

      mockFetch({
        [buildApiUrl(
          `/projects/${projectId}/merge_requests?state=opened&search=${encodeURIComponent(
            query,
          )}`,
        )]: mockMRs,
      });

      const result = await searchMergeRequests(query, projects);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Add feature X');
    });

    it('should handle merge request ID search (!123)', async () => {
      const projectId = 123;
      const iid = 100;
      const query = `!${iid}`;
      const projects = [
        { projectId, channelId: 'C123', providerType: 'gitlab' as const },
      ];
      const mockMR: GitlabMergeRequestDetails = {
        id: 999,
        iid,
        title: 'Add feature X',
        state: 'opened',
      } as GitlabMergeRequestDetails;

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}`)]: mockMR,
      });

      const result = await searchMergeRequests(query, projects);

      expect(result).toHaveLength(1);
      expect(result[0].iid).toBe(iid);
    });
  });

  describe('rebaseMergeRequest', () => {
    it('should trigger rebase for a merge request', async () => {
      const projectId = 123;
      const iid = 100;
      const mockResponse = {
        rebase_in_progress: true,
        merge_error: null,
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/merge_requests/${iid}/rebase`)]:
          mockResponse,
      });

      await expect(rebaseMergeRequest(projectId, iid)).resolves.not.toThrow();
    });
  });

  describe('runPipeline', () => {
    it('should trigger a pipeline for a branch', async () => {
      const projectId = 123;
      const ref = 'feature-branch';
      const mockPipeline: GitlabPipeline = {
        id: 456,
        iid: 1,
        project_id: projectId,
        status: 'pending',
        ref,
        sha: 'abc123',
        source: 'push',
        web_url: `${GITLAB_URL}/org/repo/-/pipelines/456`,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockFetch({
        [buildApiUrl(`/projects/${projectId}/pipeline`)]: mockPipeline,
      });

      await expect(runPipeline(projectId, ref)).resolves.not.toThrow();
    });
  });
});
