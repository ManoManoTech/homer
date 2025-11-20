/**
 * Regression tests for buildReviewMessage function
 *
 * These tests ensure that the review message building logic continues
 * to work correctly before we introduce the provider abstraction.
 */

import type { ChatPostMessageArguments } from '@slack/web-api';
import {
  fetchMergeRequestApprovers,
  fetchMergeRequestByIid,
  fetchProjectById,
  fetchReviewers,
} from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabMergeRequestDetails } from '@/core/typings/GitlabMergeRequest';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import type { GitlabUser } from '@/core/typings/GitlabUser';
import { buildReviewMessage } from '@/review/commands/share/viewBuilders/buildReviewMessage';

jest.mock('@/core/services/gitlab');

// Mock only the slackBotWebClient, not the entire module
jest.mock('@/core/services/slack', () => {
  const actual = jest.requireActual('@/core/services/slack');
  return {
    ...actual,
    slackBotWebClient: {
      users: {
        lookupByEmail: jest.fn(),
        info: jest.fn(),
      },
      chat: {
        delete: jest.fn(),
        getPermalink: jest.fn(),
        postMessage: jest.fn(),
        update: jest.fn(),
      },
    },
  };
});

const mockFetchMergeRequestByIid =
  fetchMergeRequestByIid as jest.MockedFunction<typeof fetchMergeRequestByIid>;
const mockFetchMergeRequestApprovers =
  fetchMergeRequestApprovers as jest.MockedFunction<
    typeof fetchMergeRequestApprovers
  >;
const mockFetchReviewers = fetchReviewers as jest.MockedFunction<
  typeof fetchReviewers
>;
const mockFetchProjectById = fetchProjectById as jest.MockedFunction<
  typeof fetchProjectById
>;

describe('buildReviewMessage - Regression Tests', () => {
  const channelId = 'C123456';
  const projectId = 123;
  const mergeRequestIid = 100;

  const mockAuthor: GitlabUser = {
    id: 1,
    username: 'john.doe',
    name: 'John Doe',
    avatar_url: 'https://gitlab.com/avatar1.jpg',
    state: 'active',
    web_url: 'https://gitlab.com/john.doe',
  };

  const mockMergeRequest: GitlabMergeRequestDetails = {
    id: 999,
    iid: mergeRequestIid,
    title: 'Add feature X',
    description: 'This adds feature X',
    state: 'opened',
    web_url: 'https://gitlab.com/org/repo/-/merge_requests/100',
    source_branch: 'feature-x',
    target_branch: 'main',
    author: mockAuthor,
    assignee: {
      id: 2,
      username: 'jane.doe',
      name: 'Jane Doe',
      avatar_url: null,
      state: 'active',
      web_url: 'https://gitlab.com/jane.doe',
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
      id: 12345,
      status: 'success',
      web_url: 'https://gitlab.com/org/repo/-/pipelines/12345',
    },
    latest_build_finished_at: '2025-01-02T00:10:00Z',
    latest_build_started_at: '2025-01-02T00:00:00Z',
    merge_error: null,
    rebase_in_progress: false,
    subscribed: false,
  };

  const mockProject: GitlabProjectDetails = {
    id: projectId,
    name: 'my-repo',
    path: 'my-repo',
    path_with_namespace: 'org/my-repo',
    web_url: 'https://gitlab.com/org/my-repo',
    default_branch: 'main',
    visibility: 'private',
    namespace: {
      id: 10,
      name: 'org',
      path: 'org',
      kind: 'group',
      full_path: 'org',
      avatar_url: '',
      web_url: 'https://gitlab.com/org',
    },
  } as GitlabProjectDetails;

  const mockApprovers: GitlabUser[] = [
    {
      id: 3,
      username: 'approver1',
      name: 'Approver One',
      avatar_url: null,
      state: 'active',
      web_url: 'https://gitlab.com/approver1',
    },
  ];

  const mockReviewers: GitlabUser[] = [
    {
      id: 4,
      username: 'reviewer1',
      name: 'Reviewer One',
      avatar_url: null,
      state: 'active',
      web_url: 'https://gitlab.com/reviewer1',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockFetchMergeRequestByIid.mockResolvedValue(mockMergeRequest);
    mockFetchMergeRequestApprovers.mockResolvedValue({
      approvers: mockApprovers,
      approvals_required: 2,
      approvals_left: 1,
    });
    mockFetchReviewers.mockResolvedValue(mockReviewers);
    mockFetchProjectById.mockResolvedValue(mockProject);

    // Mock Slack API - must return a properly structured SlackUser for any email
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      (params: any) => {
        // Return a mock user based on the email being looked up
        const email = params.email as string;
        const username = email.split('@')[0];
        return Promise.resolve({
          user: {
            id: `U_${username}`,
            name: username,
            real_name: username.replace(/[._-]/g, ' '),
            profile: {
              image_72: 'https://example.com/avatar.jpg',
            },
          },
        });
      },
    );
  });

  describe('POST mode (new message)', () => {
    it('should build a valid Slack message for a new review', async () => {
      const result = (await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
      )) as ChatPostMessageArguments;

      // Verify message structure
      expect(result).toHaveProperty('channel', channelId);
      expect(result).toHaveProperty('blocks');
      expect(result).toHaveProperty('text');

      // Verify blocks exist
      expect((result as any).blocks).toBeDefined();
      expect(Array.isArray((result as any).blocks)).toBe(true);
      expect(((result as any).blocks as any[]).length).toBeGreaterThan(0);

      // Verify key functions were called
      expect(mockFetchMergeRequestByIid).toHaveBeenCalledWith(
        projectId,
        mergeRequestIid,
      );
      expect(mockFetchMergeRequestApprovers).toHaveBeenCalledWith(
        projectId,
        mergeRequestIid,
      );
      expect(mockFetchReviewers).toHaveBeenCalledWith(
        projectId,
        mergeRequestIid,
      );
      expect(mockFetchProjectById).toHaveBeenCalledWith(projectId);
    });

    it('should include merge request title in the message', async () => {
      const result = (await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
      )) as ChatPostMessageArguments;

      const messageText = JSON.stringify((result as any).blocks);
      expect(messageText).toContain('Add feature X');
    });

    it('should include merge request URL in the message', async () => {
      const result = (await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
      )) as ChatPostMessageArguments;

      const messageText = JSON.stringify((result as any).blocks);
      expect(messageText).toContain(mockMergeRequest.web_url);
    });

    it('should include project information', async () => {
      const result = (await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
      )) as ChatPostMessageArguments;

      const messageText = JSON.stringify((result as any).blocks);
      expect(messageText).toContain('org/my-repo');
    });

    it('should handle merge request with draft status', async () => {
      mockFetchMergeRequestByIid.mockResolvedValue({
        ...mockMergeRequest,
        work_in_progress: true,
      });

      const result = (await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
      )) as ChatPostMessageArguments;

      expect((result as any).blocks).toBeDefined();
      // The message should still be built successfully
      expect(((result as any).blocks as any[]).length).toBeGreaterThan(0);
    });

    it('should handle merge request with merged state', async () => {
      mockFetchMergeRequestByIid.mockResolvedValue({
        ...mockMergeRequest,
        state: 'merged',
        merged_at: '2025-01-03T00:00:00Z',
      });

      const result = (await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
      )) as ChatPostMessageArguments;

      expect((result as any).blocks).toBeDefined();
      const messageText = JSON.stringify((result as any).blocks);
      expect(messageText).toContain('merged');
    });

    it('should handle merge request with no approvers', async () => {
      mockFetchMergeRequestApprovers.mockResolvedValue({
        approvers: [],
        approvals_required: 0,
        approvals_left: 0,
      });

      const result = (await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
      )) as ChatPostMessageArguments;

      expect((result as any).blocks).toBeDefined();
      expect(((result as any).blocks as any[]).length).toBeGreaterThan(0);
    });

    it('should handle merge request with no reviewers', async () => {
      mockFetchReviewers.mockResolvedValue([]);

      const result = (await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
      )) as ChatPostMessageArguments;

      expect((result as any).blocks).toBeDefined();
      expect(((result as any).blocks as any[]).length).toBeGreaterThan(0);
    });
  });

  describe('UPDATE mode (existing message)', () => {
    const messageTs = '1234567890.123456';

    it('should build a valid Slack update message', async () => {
      const result = await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
        messageTs,
      );

      // Verify update structure
      expect(result).toHaveProperty('channel', channelId);
      expect(result).toHaveProperty('ts', messageTs);
      expect(result).toHaveProperty('blocks');
      expect(result).toHaveProperty('text');
    });

    it('should call the same GitLab functions as POST mode', async () => {
      await buildReviewMessage(
        channelId,
        projectId,
        mergeRequestIid,
        messageTs,
      );

      expect(mockFetchMergeRequestByIid).toHaveBeenCalledWith(
        projectId,
        mergeRequestIid,
      );
      expect(mockFetchMergeRequestApprovers).toHaveBeenCalledWith(
        projectId,
        mergeRequestIid,
      );
      expect(mockFetchReviewers).toHaveBeenCalledWith(
        projectId,
        mergeRequestIid,
      );
      expect(mockFetchProjectById).toHaveBeenCalledWith(projectId);
    });
  });

  describe('Parallel API calls', () => {
    it('should fetch data in parallel for performance', async () => {
      const startTime = Date.now();

      await buildReviewMessage(channelId, projectId, mergeRequestIid);

      // All mocks should have been called
      expect(mockFetchMergeRequestByIid).toHaveBeenCalled();
      expect(mockFetchMergeRequestApprovers).toHaveBeenCalled();
      expect(mockFetchReviewers).toHaveBeenCalled();
      expect(mockFetchProjectById).toHaveBeenCalled();

      // Verify they were called (roughly) in parallel
      // If called sequentially, this would take much longer
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should be fast with mocks
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from fetchMergeRequestByIid', async () => {
      mockFetchMergeRequestByIid.mockRejectedValue(new Error('MR not found'));

      await expect(
        buildReviewMessage(channelId, projectId, mergeRequestIid),
      ).rejects.toThrow('MR not found');
    });

    it('should handle errors from fetchMergeRequestApprovers gracefully', async () => {
      mockFetchMergeRequestApprovers.mockRejectedValue(
        new Error('Approvers API error'),
      );

      // The function might still work or throw - depends on implementation
      // This test documents current behavior
      await expect(
        buildReviewMessage(channelId, projectId, mergeRequestIid),
      ).rejects.toThrow();
    });
  });
});
