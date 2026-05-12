import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { mergeRequestNoteHookFixture } from '../__fixtures__/mergeRequestNoteBody';
import { reviewMessageUpdateFixture } from '../__fixtures__/reviewMessage';
import { userDetailsFixture } from '../__fixtures__/userDetailsFixture';
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
      },
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
      userDetailsFixture,
    );
    jest.useFakeTimers();

    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send(mergeRequestNoteHookFixture);
    jest.runAllTimers();
    jest.useRealTimers();

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.update).toHaveBeenNthCalledWith(
      1,
      reviewMessageUpdateFixture,
    );
    await waitFor(() => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
        blocks: [
          {
            text: {
              text: `This MR needs work.\n<https://my-git.domain.com/gitlab-org/gitlab-test/merge_requests/1#note_1244|View>`,
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
        text: ':speech_balloon_blue: This MR needs work.\n',
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
      userDetailsFixture,
    );
    jest.useFakeTimers();

    // When
    await Promise.all([
      request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send(mergeRequestNoteHookFixture),
      request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send(mergeRequestNoteHookFixture),
      request(app)
        .post('/api/v1/homer/gitlab')
        .set(getGitlabHeaders())
        .send(mergeRequestNoteHookFixture),
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
This MR needs work.\n<https://my-git.domain.com/gitlab-org/gitlab-test/merge_requests/1#note_1244|View>`,
              type: 'mrkdwn',
            },
            type: 'section',
          },
          {
            text: {
              text: `\
This MR needs work.\n<https://my-git.domain.com/gitlab-org/gitlab-test/merge_requests/1#note_1244|View>`,
              type: 'mrkdwn',
            },
            type: 'section',
          },
          {
            text: {
              text: `\
This MR needs work.\n<https://my-git.domain.com/gitlab-org/gitlab-test/merge_requests/1#note_1244|View>`,
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

:speech_balloon_blue: This MR needs work.\n`,
        thread_ts: 'ts',
        unfurl_links: false,
      });
    });
  });

  it('should truncate a long note with a View link and stay under the Slack 3000-char block limit', async () => {
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
      userDetailsFixture,
    );

    // 6000-char note: would blow Slack's 3000-char block limit without truncation.
    const longNote = 'a long line of feedback markdown content\n'.repeat(150);
    jest.useFakeTimers();

    // When
    await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send({
        ...mergeRequestNoteHookFixture,
        object_attributes: {
          ...mergeRequestNoteHookFixture.object_attributes,
          note: longNote,
        },
      });
    jest.runAllTimers();
    jest.useRealTimers();

    // Then
    await waitFor(() => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    });
    const call = (slackBotWebClient.chat.postMessage as jest.Mock).mock
      .calls[0][0];
    const sectionBlocks = call.blocks.filter(
      (b: { type: string }) => b.type === 'section',
    );
    // Single block: the GitLab URL serves as the "more details" affordance.
    expect(sectionBlocks).toHaveLength(1);
    const blockText: string = sectionBlocks[0].text.text;
    expect(blockText.length).toBeLessThanOrEqual(3000);
    // Truncation marker is present, and the <url|View> link points to the full note.
    expect(blockText).toContain('Note truncated');
    expect(blockText).toContain(
      `<${mergeRequestNoteHookFixture.object_attributes.url}|View>`,
    );
  });

  it('should answer no content status whether comment is not on a merge request', async () => {
    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send(mergeRequestNoteHookFixture);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should answer no content status whether no related review is found', async () => {
    // When
    const response = await request(app)
      .post('/api/v1/homer/gitlab')
      .set(getGitlabHeaders())
      .send(mergeRequestNoteHookFixture);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });
});
