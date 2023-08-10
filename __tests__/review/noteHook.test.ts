import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { noteHookFixture } from '../__fixtures__/hooks/noteHookFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { mergeRequestNoteHookFixture } from '../__fixtures__/mergeRequestNoteBody';
import { reviewMessageUpdateFixture } from '../__fixtures__/reviewMessage';
import { userDetailsFixture } from '../__fixtures__/userDetailsFixture';
import { fetch } from '../utils/fetch';
import { getGitlabHeaders } from '../utils/getGitlabHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';
import { waitFor } from '../utils/waitFor';

describe('review > noteHook', () => {
  beforeEach(async () => {
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      ({ email }: { email: string }) => {
        const name = email.split('@')[0];
        return Promise.resolve({
          user: {
            name,
            profile: {
              image_24: 'image_24',
              image_72: 'image_72',
            },
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
    jest.useFakeTimers();

    // When
    const response = await fetch('/api/v1/homer/gitlab', {
      body: mergeRequestNoteHookFixture,
      headers: getGitlabHeaders(),
    });
    jest.runAllTimers();
    jest.useRealTimers();

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.update).toHaveBeenNthCalledWith(
      1,
      reviewMessageUpdateFixture
    );
    await waitFor(() => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
        blocks: [
          {
            text: {
              text: `This MR needs work. <http://example.com/gitlab-org/gitlab-test/merge_requests/1#note_1244|View>`,
              type: 'mrkdwn',
            },
            type: 'section',
          },
          {
            elements: [
              {
                alt_text: 'john_smith.real',
                image_url: 'image_24',
                type: 'image',
              },
              {
                text: '*john_smith.real*',
                type: 'mrkdwn',
              },
            ],
            type: 'context',
          },
        ],
        channel: 'channelId',
        icon_emoji: ':speech_balloon_blue:',
        link_names: true,
        text: ':speech_balloon_blue: This MR needs work.',
        thread_ts: 'ts',
        unfurl_links: false,
      });
    });
  });

  it('should debounce thread publications to manage Gitlab review submissions', async () => {
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
    jest.useFakeTimers();

    // When
    await Promise.all([
      fetch('/api/v1/homer/gitlab', {
        body: mergeRequestNoteHookFixture,
        headers: getGitlabHeaders(),
      }),
      fetch('/api/v1/homer/gitlab', {
        body: mergeRequestNoteHookFixture,
        headers: getGitlabHeaders(),
      }),
      fetch('/api/v1/homer/gitlab', {
        body: mergeRequestNoteHookFixture,
        headers: getGitlabHeaders(),
      }),
    ]);
    jest.runAllTimers();
    jest.useRealTimers();

    // Then
    await waitFor(() => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
      expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
        blocks: [
          {
            text: {
              text: `\
This MR needs work. <http://example.com/gitlab-org/gitlab-test/merge_requests/1#note_1244|View>`,
              type: 'mrkdwn',
            },
            type: 'section',
          },
          {
            text: {
              text: `\
This MR needs work. <http://example.com/gitlab-org/gitlab-test/merge_requests/1#note_1244|View>`,
              type: 'mrkdwn',
            },
            type: 'section',
          },
          {
            text: {
              text: `\
This MR needs work. <http://example.com/gitlab-org/gitlab-test/merge_requests/1#note_1244|View>`,
              type: 'mrkdwn',
            },
            type: 'section',
          },
          {
            elements: [
              {
                alt_text: 'john_smith.real',
                image_url: 'image_24',
                type: 'image',
              },
              {
                text: '*john_smith.real*',
                type: 'mrkdwn',
              },
            ],
            type: 'context',
          },
        ],
        channel: 'channelId',
        icon_emoji: ':speech_balloon_blue:',
        link_names: true,
        text: `\
:speech_balloon_blue: This MR needs work.

:speech_balloon_blue: This MR needs work.

:speech_balloon_blue: This MR needs work.`,
        thread_ts: 'ts',
        unfurl_links: false,
      });
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
