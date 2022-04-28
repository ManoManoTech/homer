import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient, slackWebClient } from '@/core/services/slack';
import { noteHookFixture } from '../__fixtures__/hooks/noteHookFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { mergeRequestNoteHookFixture } from '../__fixtures__/mergeRequestNoteBody';
import { userDetailsFixture } from '../__fixtures__/userDetailsFixture';
import { fetch } from '../utils/fetch';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';
import { reviewMessageUpdateFixture } from '../__fixtures__/reviewMessage';

describe('review > noteHook', () => {
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
  });

  it('should update related review messages and publish a thread message on them', async () => {
    // Given
    const channelId = 'channelId';

    await addReviewToChannel({
      channelId,
      mergeRequestIid: mergeRequestFixture.iid,
      projectId: mergeRequestFixture.project_id,
      ts: 'ts',
    });
    mockBuildReviewMessageCalls();
    mockGitlabCall(
      `/users/${mergeRequestNoteHookFixture.object_attributes.author_id}`,
      userDetailsFixture
    );

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: mergeRequestNoteHookFixture,
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackWebClient.chat.update).toHaveBeenNthCalledWith(
      1,
      reviewMessageUpdateFixture
    );
    expect(slackWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
      attachments: [
        {
          color: '#d4d4d4',
          fields: [{ short: false, title: '', value: 'Global' }],
          title: 'View it on Gitlab',
          title_link:
            'http://example.com/gitlab-org/gitlab-test/merge_requests/1#note_1244',
        },
      ],
      channel: 'channelId',
      icon_url: 'image_72',
      link_names: true,
      text: ':speech_balloon: This MR needs work.',
      thread_ts: 'ts',
      username: 'john_smith.real',
    });
  });

  it('should answer no content status whether comment is not on a merge request', async () => {
    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: noteHookFixture,
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should answer no content status whether no related review is found', async () => {
    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: mergeRequestNoteHookFixture,
      headers: getGitlabHeaders(),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });
});
