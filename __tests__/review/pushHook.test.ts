import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient, slackWebClient } from '@/core/services/slack';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { pushHookFixture } from '../__fixtures__/hooks/pushHookFixture';
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
    const branchName = pushHookFixture.ref.split('/').pop();
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
    expect(slackWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
      attachments: [
        {
          author_icon: 'image_24',
          author_name: 'gitlabdev.real',
          color: '#d4d4d4',
          footer: '2 changes',
          title: 'fixed readme',
          title_link:
            'http://example.com/mike/diaspora/commit/da1560886d4f094c3e6c9ef40349f7d38b5d27d7',
        },
      ],
      channel: 'channelId',
      icon_emoji: ':point_up:',
      link_names: true,
      text: 'New commit',
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
