import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import {
  pushHookFixture,
  pushHookFixtureFeatureBranch,
} from '../__fixtures__/hooks/pushHookFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { fetch } from '../utils/fetch';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('review > pushHook', () => {
  beforeEach(async () => {
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      ({ email }: { email: string }) => {
        const name = email.split('@')[0];
        return Promise.resolve({
          user: {
            name,
            profile: { image_24: 'image_24' },
            real_name: `${name}.real`,
          },
        });
      }
    );
  });

  it('should publish a message on related review messages', async () => {
    // Given
    const branchName = 'master';
    const channelId = 'channelId';

    mockGitlabCall(
      `/projects/${pushHookFixture.project_id}/merge_requests?source_branch=${branchName}`,
      [mergeRequestFixture]
    );
    mockGitlabCall(
      `/projects/${pushHookFixture.project_id}/merge_requests/${mergeRequestFixture.iid}/commits?per_page=100`,
      [{ id: pushHookFixture.commits[1].id }]
    );
    await addReviewToChannel({
      channelId,
      mergeRequestIid: mergeRequestFixture.iid,
      projectId: mergeRequestFixture.project_id,
      ts: 'ts',
    });

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: pushHookFixture,
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
      blocks: [
        {
          text: {
            text: '<http://example.com/mike/diaspora/commit/da1560886d4f094c3e6c9ef40349f7d38b5d27d7|fixed readme>',
            type: 'mrkdwn',
          },
          type: 'section',
        },
        {
          elements: [
            {
              alt_text: 'gitlabdev.real',
              image_url: 'image_24',
              type: 'image',
            },
            {
              text: '*gitlabdev.real*',
              type: 'mrkdwn',
            },
            {
              text: '2 changes',
              type: 'plain_text',
            },
          ],
          type: 'context',
        },
      ],
      channel: 'channelId',
      icon_emoji: ':git-commit:',
      text: ':git-commit: New commit(s)',
      thread_ts: 'ts',
    });
  });

  it('should publish a message on related review messages for branch containing a slash', async () => {
    // Given
    const branchName = 'feat/add-logo';
    const channelId = 'channelId';

    mockGitlabCall(
      `/projects/${pushHookFixtureFeatureBranch.project_id}/merge_requests?source_branch=${branchName}`,
      [mergeRequestFixture]
    );
    mockGitlabCall(
      `/projects/${pushHookFixtureFeatureBranch.project_id}/merge_requests/${mergeRequestFixture.iid}/commits?per_page=100`,
      [{ id: pushHookFixtureFeatureBranch.commits[1].id }]
    );
    await addReviewToChannel({
      channelId,
      mergeRequestIid: mergeRequestFixture.iid,
      projectId: mergeRequestFixture.project_id,
      ts: 'ts',
    });

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: pushHookFixtureFeatureBranch,
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
      blocks: [
        {
          text: {
            text: '<http://example.com/mike/diaspora/commit/da1560886d4f094c3e6c9ef40349f7d38b5d27d7|fixed readme>',
            type: 'mrkdwn',
          },
          type: 'section',
        },
        {
          elements: [
            {
              alt_text: 'gitlabdev.real',
              image_url: 'image_24',
              type: 'image',
            },
            {
              text: '*gitlabdev.real*',
              type: 'mrkdwn',
            },
            {
              text: '2 changes',
              type: 'plain_text',
            },
          ],
          type: 'context',
        },
      ],
      channel: 'channelId',
      icon_emoji: ':git-commit:',
      text: ':git-commit: New commit(s)',
      thread_ts: 'ts',
    });
  });

  it('should answer no content status whether there is no commit', async () => {
    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: { ...pushHookFixture, commits: [] },
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should answer no content status whether no related review found', async () => {
    // Given
    const branchName = pushHookFixture.ref.split('/').pop();

    mockGitlabCall(
      `/projects/${pushHookFixture.project_id}/merge_requests?source_branch=${branchName}`,
      [mergeRequestFixture]
    );
    mockGitlabCall(
      `/projects/${pushHookFixture.project_id}/merge_requests/${mergeRequestFixture.iid}/commits?per_page=100`,
      []
    );

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: pushHookFixture,
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });
});
