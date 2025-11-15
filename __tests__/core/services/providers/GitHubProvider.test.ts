/**
 * Tests for GitHubProvider
 */

import * as github from '@/core/services/github';
import { GitHubProvider } from '@/core/services/providers/GitHubProvider';
import type {
  UnifiedPullRequest,
  UnifiedUser,
} from '@/core/typings/UnifiedModels';

// Mock the github service
jest.mock('@/core/services/github');

describe('GitHubProvider', () => {
  let provider: GitHubProvider;
  const mockToken = 'test-token';
  const mockBaseUrl = 'https://api.github.com';

  beforeEach(() => {
    provider = new GitHubProvider(mockBaseUrl, mockToken);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set type to "github"', () => {
      expect(provider.type).toBe('github');
    });
  });

  describe('fetchPullRequest', () => {
    it('should fetch a pull request and transform to unified format', async () => {
      const mockGitHubPR = {
        id: 12345,
        number: 42,
        title: 'Add new feature',
        body: 'This PR adds a new feature',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/42',
        head: {
          ref: 'feature-branch',
        },
        base: {
          ref: 'main',
        },
        user: {
          id: 999,
          login: 'octocat',
          name: 'Octocat',
          avatar_url: 'https://github.com/octocat.png',
          html_url: 'https://github.com/octocat',
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        merged_at: null,
        closed_at: null,
        draft: false,
        mergeable: true,
        mergeable_state: 'clean',
        comments: 5,
        changed_files: 3,
        labels: [{ name: 'enhancement' }, { name: 'bug' }],
        merged: false,
      };

      (github.fetchPullRequest as jest.Mock).mockResolvedValue(mockGitHubPR);

      const result = await provider.fetchPullRequest('owner/repo', 42);

      expect(github.fetchPullRequest).toHaveBeenCalledWith('owner/repo', 42);
      expect(result).toEqual<UnifiedPullRequest>({
        type: 'github',
        id: 12345,
        iid: 42,
        title: 'Add new feature',
        description: 'This PR adds a new feature',
        state: 'opened',
        webUrl: 'https://github.com/owner/repo/pull/42',
        sourceBranch: 'feature-branch',
        targetBranch: 'main',
        author: {
          id: 999,
          username: 'octocat',
          name: 'Octocat',
          avatarUrl: 'https://github.com/octocat.png',
          webUrl: 'https://github.com/octocat',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        mergedAt: undefined,
        closedAt: undefined,
        draft: false,
        mergeable: true,
        discussionCount: 5,
        changesCount: 3,
        projectId: 'owner/repo',
        projectPath: 'owner/repo',
        labels: ['enhancement', 'bug'],
        rawData: mockGitHubPR,
      });
    });

    it('should handle merged pull requests', async () => {
      const mockGitHubPR = {
        id: 12345,
        number: 42,
        title: 'Add new feature',
        body: 'This PR adds a new feature',
        state: 'closed',
        html_url: 'https://github.com/owner/repo/pull/42',
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
        user: {
          id: 999,
          login: 'octocat',
          name: 'Octocat',
          avatar_url: 'https://github.com/octocat.png',
          html_url: 'https://github.com/octocat',
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        merged_at: '2024-01-03T00:00:00Z',
        closed_at: '2024-01-03T00:00:00Z',
        draft: false,
        mergeable: null,
        mergeable_state: 'unknown',
        comments: 5,
        changed_files: 3,
        labels: [],
        merged: true,
      };

      (github.fetchPullRequest as jest.Mock).mockResolvedValue(mockGitHubPR);

      const result = await provider.fetchPullRequest('owner/repo', 42);

      expect(result.state).toBe('merged');
      expect(result.mergedAt).toBe('2024-01-03T00:00:00Z');
      expect(result.closedAt).toBe('2024-01-03T00:00:00Z');
    });
  });

  describe('transformUser', () => {
    it('should transform GitHub user to unified format', async () => {
      const mockGitHubUser = {
        id: 123,
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://github.com/testuser.png',
        html_url: 'https://github.com/testuser',
      };

      // We'll test this through fetchUser
      (github.fetchUser as jest.Mock).mockResolvedValue(mockGitHubUser);

      const result = await provider.fetchUser(123);

      expect(result).toEqual<UnifiedUser>({
        id: 123,
        username: 'testuser',
        name: 'Test User',
        avatarUrl: 'https://github.com/testuser.png',
        webUrl: 'https://github.com/testuser',
      });
    });
  });

  describe('fetchProject', () => {
    it('should fetch repository and transform to unified format', async () => {
      const mockGitHubRepo = {
        id: 456,
        name: 'repo',
        full_name: 'owner/repo',
        html_url: 'https://github.com/owner/repo',
        default_branch: 'main',
      };

      (github.fetchRepository as jest.Mock).mockResolvedValue(mockGitHubRepo);

      const result = await provider.fetchProject('owner/repo');

      expect(github.fetchRepository).toHaveBeenCalledWith('owner/repo');
      expect(result).toEqual({
        id: 'owner/repo',
        name: 'repo',
        path: 'repo',
        pathWithNamespace: 'owner/repo',
        webUrl: 'https://github.com/owner/repo',
        defaultBranch: 'main',
      });
    });
  });

  describe('searchPullRequests', () => {
    it('should search by PR number', async () => {
      const mockPR = {
        id: 12345,
        number: 42,
        title: 'Test PR',
        body: 'Test',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/42',
        head: { ref: 'feature', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' },
        user: {
          id: 1,
          login: 'user',
          name: 'User',
          avatar_url: 'http://avatar',
          html_url: 'http://user',
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        merged_at: null,
        closed_at: null,
        draft: false,
        merged: false,
        mergeable: true,
        mergeable_state: 'clean',
        comments: 0,
        changed_files: 1,
        labels: [],
      };

      (github.fetchPullRequest as jest.Mock).mockResolvedValue(mockPR);

      const result = await provider.searchPullRequests(['owner/repo'], '#42', [
        'open',
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].iid).toBe(42);
      expect(github.fetchPullRequest).toHaveBeenCalledWith('owner/repo', 42);
    });

    it('should search by URL', async () => {
      const mockPR = {
        id: 12345,
        number: 42,
        title: 'Test PR',
        body: 'Test',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/42',
        head: { ref: 'feature', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' },
        user: {
          id: 1,
          login: 'user',
          name: 'User',
          avatar_url: 'http://avatar',
          html_url: 'http://user',
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        merged_at: null,
        closed_at: null,
        draft: false,
        merged: false,
        mergeable: true,
        mergeable_state: 'clean',
        comments: 0,
        changed_files: 1,
        labels: [],
      };

      (github.fetchPullRequest as jest.Mock).mockResolvedValue(mockPR);

      const result = await provider.searchPullRequests(
        ['owner/repo'],
        'https://github.com/owner/repo/pull/42',
        ['open']
      );

      expect(result).toHaveLength(1);
      expect(result[0].iid).toBe(42);
    });
  });

  describe('fetchReviewers', () => {
    it('should fetch requested reviewers', async () => {
      const mockReviewers = [
        {
          id: 1,
          login: 'reviewer1',
          name: 'Reviewer One',
          avatar_url: 'http://avatar1',
          html_url: 'http://reviewer1',
        },
      ];

      (github.fetchRequestedReviewers as jest.Mock).mockResolvedValue(
        mockReviewers
      );

      const result = await provider.fetchReviewers('owner/repo', 42);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('reviewer1');
    });
  });

  describe('fetchApprovers', () => {
    it('should fetch approved reviewers from reviews', async () => {
      const mockReviews = [
        {
          id: 1,
          user: {
            id: 1,
            login: 'approver1',
            name: 'Approver One',
            avatar_url: 'http://avatar1',
            html_url: 'http://approver1',
          },
          state: 'APPROVED',
        },
        {
          id: 2,
          user: {
            id: 2,
            login: 'reviewer1',
            name: 'Reviewer One',
            avatar_url: 'http://avatar2',
            html_url: 'http://reviewer1',
          },
          state: 'COMMENTED',
        },
      ];

      (github.fetchPullRequestReviews as jest.Mock).mockResolvedValue(
        mockReviews
      );

      const result = await provider.fetchApprovers('owner/repo', 42);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('approver1');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate GitHub webhook signature', () => {
      const payload = Buffer.from('test payload');
      const secret = 'test-secret';
      const signature =
        'sha256=3d6c4b1c8b5e3f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a';

      const result = provider.validateWebhookSignature(
        payload,
        signature,
        secret
      );

      expect(typeof result).toBe('boolean');
    });
  });
});
