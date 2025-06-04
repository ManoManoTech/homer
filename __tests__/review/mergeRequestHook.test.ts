import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel, addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { projectFixture } from '@root/__tests__/__fixtures__/projectFixture';
import { mergeRequestHookFixture } from '../__fixtures__/hooks/mergeRequestHookFixture';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import {
  reviewMessagePostFixture,
  reviewMessageUpdateFixture,
} from '../__fixtures__/reviewMessage';
import { fetch } from '../utils/fetch';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';

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
      }
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
        ts: 'ts',
      });
      mockBuildReviewMessageCalls();

      // When
      const response = await fetch('/api/v1/homer/gitlab', {
        body: {
          ...mergeRequestHookFixture,
          object_attributes: {
            ...object_attributes,
            action,
          },
        },
        headers: getGitlabHeaders(),
      });

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      expect(slackBotWebClient.chat.update).toHaveBeenNthCalledWith(
        1,
        reviewMessageUpdateFixture
      );
      expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
        channel: channelId,
        icon_emoji: iconEmoji,
        text,
        thread_ts: 'ts',
      });
    }
  );

  it('should display closed status in review message', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;
    const { iid, project_id } = mergeRequestFixture;
    const channelId = 'channelId';

    await addReviewToChannel({
      channelId,
      mergeRequestIid: object_attributes.iid,
      projectId: project_id,
      ts: 'ts',
    });
    mockBuildReviewMessageCalls();
    mockGitlabCall(`/projects/${project_id}/merge_requests/${iid}`, {
      ...mergeRequestDetailsFixture,
      state: 'closed',
    });

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'merge',
        },
      },
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      (slackBotWebClient.chat.update as jest.Mock).mock.calls[0]?.[0]
        ?.blocks?.[0]?.text?.text
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
      projectId: project_id,
      ts: 'ts',
    });
    mockBuildReviewMessageCalls();
    mockGitlabCall(`/projects/${project_id}/merge_requests/${iid}`, {
      ...mergeRequestDetailsFixture,
      state: 'merged',
    });

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'merge',
        },
      },
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      (slackBotWebClient.chat.update as jest.Mock).mock.calls[0]?.[0]
        ?.blocks?.[0]?.text?.text
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
      ts: 'ts',
    });
    mockBuildReviewMessageCalls();

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'update',
        },
      },
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.update).toHaveBeenNthCalledWith(
      1,
      reviewMessageUpdateFixture
    );
    expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('should answer no content status whether the action is not managed', async () => {
    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: mergeRequestHookFixture,
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should answer no content status whether no related review found', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'approved',
        },
      },
      headers: getGitlabHeaders(),
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
      ts: 'ts',
    });
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockResolvedValue(
      undefined
    );

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        object_attributes: {
          ...object_attributes,
          action: 'approved',
        },
      },
      headers: getGitlabHeaders(),
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
    });

    mockBuildReviewMessageCalls();

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        labels: [{ title: 'homer-review' }],
        object_attributes: {
          ...object_attributes,
          action: 'open',
        },
      },
      headers: getGitlabHeaders(),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: object_attributes.iid,
        ts: 'ts',
      })
    ).toEqual(true);
  });

  it('should answer ok status when merge request contains homer-review label and project is not linked to a channel', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        labels: [{ title: 'homer-review' }],
        object_attributes: {
          ...object_attributes,
          action: 'open',
        },
      },
      headers: getGitlabHeaders(),
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
    });

    mockBuildReviewMessageCalls();
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        labels: [{ title: 'homer-mergeable' }],
        object_attributes: {
          ...object_attributes,
          detailed_merge_status: 'mergeable',
          action: 'update',
        },
      },
      headers: getGitlabHeaders(),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: object_attributes.iid,
        ts: 'ts',
      })
    ).toEqual(true);
  });

  it('should answer no content status when merge request contains homer-mergeable label and state is not mergeable', async () => {
    // Given
    const { object_attributes } = mergeRequestHookFixture;
    const channelId = 'channelId';

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
    });

    mockBuildReviewMessageCalls();

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: {
        ...mergeRequestHookFixture,
        labels: [{ title: 'homer-mergeable' }],
        object_attributes: {
          ...object_attributes,
          action: 'update',
        },
      },
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });
});
