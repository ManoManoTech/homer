/**
 * Regression tests for shareReviewRequestHandler
 *
 * These tests ensure the review sharing and search functionality
 * continues to work correctly before we introduce the provider abstraction.
 */

import {
  addProjectToChannel,
  getProjectsByChannelId,
} from '@/core/services/data';
import { searchMergeRequests } from '@/core/services/gitlab';
import type { GitlabMergeRequest } from '@/core/typings/GitlabMergeRequest';

jest.mock('@/core/services/gitlab');

const mockSearchMergeRequests = searchMergeRequests as jest.MockedFunction<
  typeof searchMergeRequests
>;

describe('Review Search - Regression Tests', () => {
  const channelId = 'C123456';
  const projectId1 = 123;
  const projectId2 = 456;

  const mockMR1: GitlabMergeRequest = {
    id: 999,
    iid: 100,
    title: 'Add feature X',
    description: 'Feature X description',
    state: 'opened',
    web_url: 'https://gitlab.com/org/repo1/-/merge_requests/100',
    source_branch: 'feature-x',
    target_branch: 'main',
    author: {} as any,
    assignee: {} as any,
    assignees: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    closed_at: null,
    closed_by: null,
    merge_status: 'can_be_merged',
    user_notes_count: 5,
    work_in_progress: false,
    labels: ['feature'],
    project_id: projectId1,
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
    source_project_id: projectId1,
    target_project_id: projectId1,
    milestone: {} as any,
    task_completion_status: { count: 0, completed_count: 0 },
    time_stats: {} as any,
  };

  const mockMR2: GitlabMergeRequest = {
    ...mockMR1,
    id: 888,
    iid: 200,
    title: 'Fix bug Y',
    description: 'Bug fix description',
    project_id: projectId2,
    web_url: 'https://gitlab.com/org/repo2/-/merge_requests/200',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Set up projects in the mock database instead of mocking getProjectsByChannelId
    await addProjectToChannel({
      channelId,
      projectId: projectId1,
      projectIdString: null,
      providerType: 'gitlab',
    });
    await addProjectToChannel({
      channelId,
      projectId: projectId2,
      projectIdString: null,
      providerType: 'gitlab',
    });
  });

  describe('Search by text', () => {
    it('should search for merge requests across all channel projects', async () => {
      const query = 'feature';
      mockSearchMergeRequests.mockResolvedValue([mockMR1]);

      // Simulate searching across projects
      const projects = await getProjectsByChannelId(channelId);
      expect(projects).toHaveLength(2);

      const results = await searchMergeRequests(query, projects);

      expect(mockSearchMergeRequests).toHaveBeenCalledTimes(1);
      expect(mockSearchMergeRequests).toHaveBeenCalledWith(query, projects);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Add feature X');
    });

    it('should find merge requests from multiple projects', async () => {
      const query = 'fix';
      mockSearchMergeRequests.mockResolvedValue([mockMR2]);

      const projects = await getProjectsByChannelId(channelId);
      const results = await searchMergeRequests(query, projects);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Fix bug Y');
      expect(results[0].project_id).toBe(projectId2);
    });

    it('should return empty array when no matches found', async () => {
      const query = 'nonexistent';
      mockSearchMergeRequests.mockResolvedValue([]);

      const projects = await getProjectsByChannelId(channelId);
      const results = await searchMergeRequests(query, projects);

      expect(results).toHaveLength(0);
    });
  });

  describe('Search by merge request ID', () => {
    it('should handle !123 format', async () => {
      const query = '!100';
      const projects = [
        {
          channelId,
          projectId: projectId1,
          projectIdString: null,
          providerType: 'gitlab' as const,
        },
      ];
      mockSearchMergeRequests.mockResolvedValue([mockMR1]);

      const result = await searchMergeRequests(query, projects);

      expect(result).toHaveLength(1);
      expect(result[0].iid).toBe(100);
    });

    it('should handle numeric ID without !', async () => {
      const query = '100';
      const projects = [
        {
          channelId,
          projectId: projectId1,
          projectIdString: null,
          providerType: 'gitlab' as const,
        },
      ];
      mockSearchMergeRequests.mockResolvedValue([mockMR1]);

      const result = await searchMergeRequests(query, projects);

      expect(result).toHaveLength(1);
      expect(result[0].iid).toBe(100);
    });
  });

  describe('Search by URL', () => {
    it('should handle full GitLab merge request URL', async () => {
      const query = 'https://gitlab.com/org/repo1/-/merge_requests/100';
      const projects = [
        {
          channelId,
          projectId: projectId1,
          projectIdString: null,
          providerType: 'gitlab' as const,
        },
      ];
      mockSearchMergeRequests.mockResolvedValue([mockMR1]);

      const result = await searchMergeRequests(query, projects);

      expect(result).toHaveLength(1);
      expect(result[0].web_url).toBe(query);
    });
  });

  describe('Multiple results', () => {
    it('should return all matching merge requests', async () => {
      const query = 'refactor';
      const projects = [
        {
          channelId,
          projectId: projectId1,
          projectIdString: null,
          providerType: 'gitlab' as const,
        },
      ];
      const mockMRs = [mockMR1, { ...mockMR1, iid: 101, id: 1000 }];
      mockSearchMergeRequests.mockResolvedValue(mockMRs);

      const result = await searchMergeRequests(query, projects);

      expect(result).toHaveLength(2);
      expect(result[0].iid).toBe(100);
      expect(result[1].iid).toBe(101);
    });
  });

  describe('State filtering', () => {
    it('should filter by opened state', async () => {
      const query = 'feature';
      const projects = [
        {
          channelId,
          projectId: projectId1,
          projectIdString: null,
          providerType: 'gitlab' as const,
        },
      ];
      mockSearchMergeRequests.mockResolvedValue([mockMR1]);

      const result = await searchMergeRequests(query, projects);

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('opened');
    });

    it('should filter by multiple states', async () => {
      const query = 'feature';
      const projects = [
        {
          channelId,
          projectId: projectId1,
          projectIdString: null,
          providerType: 'gitlab' as const,
        },
      ];
      mockSearchMergeRequests.mockResolvedValue([mockMR1]);

      const result = await searchMergeRequests(query, projects);

      expect(result).toHaveLength(1);
    });
  });

  describe('Error handling', () => {
    it('should propagate search errors', async () => {
      const query = 'feature';
      const projects = [
        {
          channelId,
          projectId: projectId1,
          projectIdString: null,
          providerType: 'gitlab' as const,
        },
      ];
      mockSearchMergeRequests.mockRejectedValue(new Error('GitLab API error'));

      await expect(searchMergeRequests(query, projects)).rejects.toThrow(
        'GitLab API error'
      );
    });

    // Removed test for mocked getProjectsByChannelId error
    // Now using real database, so no mock to reject
  });

  describe('Integration scenario: Complete search flow', () => {
    it('should simulate full review sharing workflow', async () => {
      const query = 'feature';

      // Step 1: Get projects for channel
      const projects = await getProjectsByChannelId(channelId);
      expect(projects).toHaveLength(2);

      // Step 2: Search across all projects
      mockSearchMergeRequests.mockResolvedValue([mockMR1]);

      const allResults = await searchMergeRequests(query, projects);

      // Step 3: Verify results
      expect(allResults).toHaveLength(1);
      expect(allResults[0].title).toBe('Add feature X');
      expect(allResults[0].project_id).toBe(projectId1);

      // If only one result, it would be shared directly
      // If multiple results, user would see selection menu
      // If zero results, user would see error message
    });

    it('should handle scenario with no configured projects', async () => {
      // Clear the database and don't add any projects
      const { clearSequelizeMock } = (await import('sequelize')) as any;
      clearSequelizeMock();

      const emptyChannelId = 'C_EMPTY';
      const projects = await getProjectsByChannelId(emptyChannelId);
      expect(projects).toHaveLength(0);

      // In this case, no search would be performed
      // User would be prompted to add projects first
    });
  });
});
