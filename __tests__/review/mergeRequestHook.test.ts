import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel, addReviewToChannel } from '@/core/services/data';
import * as github from '@/core/services/github';
import { slackBotWebClient } from '@/core/services/slack';
import { projectFixture } from '@root/__tests__/__fixtures__/projectFixture';
import { mergeRequestHookFixture } from '../__fixtures__/hooks/mergeRequestHookFixture';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import {
  reviewMessagePostFixture,
  reviewMessageUpdateFixture,
} from '../__fixtures__/reviewMessage';
import { getGitHubHeaders } from '../utils/getGitHubHeaders';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';
import { waitFor } from '../utils/waitFor';

jest.mock('@/core/services/github');

describe('review > mergeRequestHook', () => {
  beforeEach(async () => {
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      ({ email }: { email: string }) => {
        const name = email.split('@')[0];
        return Promise.resolve({
          user: {
            name,
            profile: { image_72: 'image_72' },
            real_name: `${name}.real`,
          },
        });
      },
    );
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });
  });

  it.each([
    [
      'approved',
      ':thumbsup_blue:',
      '*root.real* has approved this merge request.',
    ],
    [
      'close',
      ':closed_book_blue:',
      '*root.real* has closed this merge request.',
    ],
    ['merge', ':git-merge:', '*root.real* has merged this merge request.'],
    [
      'unapproved',
      ':thumbsdown_blue:',
      '*root.real* has unapproved this merge request.',
    ],
  ])(
    'should update related review messages and publish a thread message on it whether "%s" action is received',
    async (action, iconEmoji, text) => {
      // Given
      const { object_attributes, project } = mergeRequestHookFixture;
      const channelId = 'channelId';

      await addReviewToChannel({
        channelId,
        mergeRequestIid: object_attributes.iid,
        projectId: project.id,
        projectIdString: null,
        providerType: 'gitlab',
        ts: 'ts',
      });
      mockBuildReviewMessageCalls();

      // When
      const response = await request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send({
          ...mergeRequestHookFixture,
          object_attributes: {
            ...object_attributes,
            action,
          },
        });

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      expect(slackBotWebClient.chat.update).toHaveBeenNthCalledWith(
        1,
        reviewMessageUpdateFixture,
      );
      expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
        channel: channelId,
        icon_emoji: iconEmoji,
        text,
        thread_ts: 'ts',
      });
    },
  );

  it('should display closed status in review message', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;
    const { iid, project_id } = mergeRequestFixture;
    const channelId = 'channelId';

    await addReviewToChannel({
      channelId,
      mergeRequestIid: object_attributes.iid,
      projectId: typeof project_id === 'number' ? project_id : null,
      projectIdString: typeof project_id === 'string' ? project_id : null,
      providerType: 'gitlab',
      ts: 'ts',
    });
    mockBuildReviewMessageCalls();
    mockGitlabCall(`/projects/${project_id}/merge_requests/${iid}`, {
      ...mergeRequestDetailsFixture,
      state: 'closed',
    });

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'merge',
        },
      });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      (slackBotWebClient.chat.update as jest.Mock).mock.calls[0]?.[0]
        ?.blocks?.[0]?.text?.text,
    ).toContain('~merge request title~ (closed)');
  });

  it('should display merged status in review message', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;
    const { iid, project_id } = mergeRequestFixture;
    const channelId = 'channelId';

    await addReviewToChannel({
      channelId,
      mergeRequestIid: object_attributes.iid,
      projectId: typeof project_id === 'number' ? project_id : null,
      projectIdString: typeof project_id === 'string' ? project_id : null,
      providerType: 'gitlab',
      ts: 'ts',
    });
    mockBuildReviewMessageCalls();
    mockGitlabCall(`/projects/${project_id}/merge_requests/${iid}`, {
      ...mergeRequestDetailsFixture,
      state: 'merged',
    });

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'merge',
        },
      });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      (slackBotWebClient.chat.update as jest.Mock).mock.calls[0]?.[0]
        ?.blocks?.[0]?.text?.text,
    ).toContain('~merge request title~ (merged)');
  });

  it('should only update related review messages whether "update" action is received', async () => {
    // Given
    const { object_attributes, project } = mergeRequestHookFixture;
    const channelId = 'channelId';

    await addReviewToChannel({
      channelId,
      mergeRequestIid: object_attributes.iid,
      projectId: project.id,
      projectIdString: null,
      providerType: 'gitlab',
      ts: 'ts',
    });
    mockBuildReviewMessageCalls();

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'update',
        },
      });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.update).toHaveBeenNthCalledWith(
      1,
      reviewMessageUpdateFixture,
    );
    expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('should answer no content status whether the action is not managed', async () => {
    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send(mergeRequestHookFixture);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should answer no content status whether no related review found', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'approved',
        },
      });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should answer no content status whether Slack user not found', async () => {
    // Given
    const { object_attributes, project } = mergeRequestHookFixture;

    await addReviewToChannel({
      channelId: 'channelId',
      mergeRequestIid: object_attributes.iid,
      projectId: project.id,
      projectIdString: null,
      providerType: 'gitlab',
      ts: 'ts',
    });
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockResolvedValue(
      undefined,
    );

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'approved',
        },
      });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should create review message when merge request contains homer-review label', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;
    const channelId = 'channelId';

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
      projectIdString: null,
      providerType: 'gitlab',
    });

    mockBuildReviewMessageCalls();

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        labels: [{ title: 'homer-review' }],
        object_attributes: {
          ...object_attributes,
          action: 'open',
        },
      });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture,
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: object_attributes.iid,
        ts: 'ts',
      }),
    ).toEqual(true);
  });

  it('should answer ok status when merge request contains homer-review label and project is not linked to a channel', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        labels: [{ title: 'homer-review' }],
        object_attributes: {
          ...object_attributes,
          action: 'open',
        },
      });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
  });

  it('should create review message when merge request contains homer-mergeable label and state is mergeable', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;
    const channelId = 'channelId';

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
      projectIdString: null,
      providerType: 'gitlab',
    });

    mockBuildReviewMessageCalls();
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        labels: [{ title: 'homer-mergeable' }],
        object_attributes: {
          ...object_attributes,
          detailed_merge_status: 'mergeable',
          action: 'update',
        },
      });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture,
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: object_attributes.iid,
        ts: 'ts',
      }),
    ).toEqual(true);
  });

  it('should answer no content status when merge request contains homer-mergeable label and state is not mergeable', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;
    const channelId = 'channelId';

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
      projectIdString: null,
      providerType: 'gitlab',
    });

    mockBuildReviewMessageCalls();

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestHookFixture,
        labels: [{ title: 'homer-mergeable' }],
        object_attributes: {
          ...object_attributes,
          action: 'update',
        },
      });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  describe('GitHub webhooks', () => {
    it('should update related review messages when pull_request_review with approved state is received', async () => {
      // Given
      const repoFullName = 'owner/repo';
      const prNumber = 42;
      const channelId = 'channelId';

      await addReviewToChannel({
        channelId,
        mergeRequestIid: prNumber,
        projectId: null,
        projectIdString: repoFullName,
        providerType: 'github',
        ts: 'ts',
      });

      // Mock GitHub service
      (github.fetchPullRequest as jest.Mock).mockResolvedValue({
        id: 1,
        number: prNumber,
        title: 'Test PR',
        body: 'Test PR body',
        state: 'open',
        draft: false,
        html_url: `https://github.com/${repoFullName}/pull/${prNumber}`,
        user: {
          id: 1,
          login: 'author',
          avatar_url: 'https://github.com/author.png',
          html_url: 'https://github.com/author',
          name: 'Author',
        },
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        merged_at: null,
        closed_at: null,
        comments: 0,
        changed_files: 1,
        labels: [],
        mergeable: true,
        merged: false,
      });

      (github.fetchPullRequestReviews as jest.Mock).mockResolvedValue([
        {
          id: 123,
          state: 'APPROVED',
          user: { id: 2, login: 'reviewer', avatar_url: '', html_url: '' },
        },
      ]);

      (github.fetchRequestedReviewers as jest.Mock).mockResolvedValue([]);
      (github.fetchPullRequestAssignees as jest.Mock).mockResolvedValue([]);
      (github.fetchRepository as jest.Mock).mockResolvedValue({
        full_name: repoFullName,
        name: 'repo',
        html_url: `https://github.com/${repoFullName}`,
        default_branch: 'main',
      });

      const payload = {
        action: 'submitted',
        review: {
          id: 123,
          state: 'approved',
          user: {
            id: 1,
            login: 'reviewer',
          },
        },
        pull_request: {
          number: prNumber,
          title: 'Test PR',
          labels: [],
        },
        repository: {
          full_name: repoFullName,
        },
        sender: {
          login: 'reviewer',
        },
      };

      const payloadString = JSON.stringify(payload);

      // When
      const response = await request(app)
        .post('/api/v1/homer/github')
        .set(getGitHubHeaders('pull_request_review', payloadString))
        .send(payload);

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);

      // Wait for async Slack updates
      await waitFor(() => {
        expect(slackBotWebClient.chat.update).toHaveBeenCalled();
      });

      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: channelId,
          icon_emoji: ':thumbsup_blue:',
          text: expect.stringContaining('has approved this merge request'),
          thread_ts: 'ts',
        }),
      );
    });
  });
});
