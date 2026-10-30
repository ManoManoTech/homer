import slackifyMarkdown from 'slackify-markdown';
import request from 'supertest';
import { app } from '@/app';
import { CONFIG } from '@/config';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestReviewersFixture } from '../__fixtures__/mergeRequestReviewersFixture';
import { slackUserFixture } from '../__fixtures__/slackUserFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('review > listReviews', () => {
  it('should allow user to list reviews', async () => {
    // Given
    const channelId = 'channelId';
    const mergeRequestIid1 = 1;
    const mergeRequestIid2 = 2;
    const projectId = 1;
    const ts = 'ts';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'review list',
      user_id: userId,
    };

    await addReviewToChannel({
      channelId,
      mergeRequestIid: mergeRequestIid1,
      projectId,
      ts,
    });
    await addReviewToChannel({
      channelId,
      mergeRequestIid: mergeRequestIid2,
      projectId,
      ts,
    });

    mockGitlabCall(
      `/projects/${projectId}/merge_requests/${mergeRequestIid1}`,
      mergeRequestDetailsFixture,
    );
    mockGitlabCall(
      `/projects/${projectId}/merge_requests/${mergeRequestIid2}`,
      mergeRequestDetailsFixture,
    );
    (slackBotWebClient.chat.getPermalink as jest.Mock).mockReturnValue({
      permalink:
        'https://manomano-team.slack.com/archives/CKXA1FASF/p1640343776000900',
    });

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
      blocks: [
        {
          text: {
            text: slackifyMarkdown(`**Ongoing reviews:**
- [merge request title](https://manomano-team.slack.com/archives/CKXA1FASF/p1640343776000900)
- [merge request title](https://manomano-team.slack.com/archives/CKXA1FASF/p1640343776000900)`),
            type: 'mrkdwn',
          },
          type: 'section',
        },
      ],
      channel: 'channelId',
      text: 'Ongoing reviews: merge request title, merge request title.',
      user: 'userId',
    });
  });

  it('should link each review to its own message when merge requests from different projects share an iid', async () => {
    // Given
    const channelId = 'channelId';
    const mergeRequestIid = 1;
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'review list',
      user_id: userId,
    };
    const reviews = [
      { projectId: 1, ts: 'ts1', title: 'first project' },
      { projectId: 2, ts: 'ts2', title: 'second project' },
    ];

    for (const { projectId, ts, title } of reviews) {
      await addReviewToChannel({ channelId, mergeRequestIid, projectId, ts });
      mockGitlabCall(
        `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
        {
          ...mergeRequestDetailsFixture,
          title,
        },
      );
    }
    (slackBotWebClient.chat.getPermalink as jest.Mock).mockImplementation(
      ({ message_ts }: { message_ts: string }) => ({
        permalink: `https://slack/${message_ts}`,
      }),
    );

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(
      (slackBotWebClient.chat.postEphemeral as jest.Mock).mock.calls[0][0]
        .blocks[0].text.text,
    ).toEqual(
      slackifyMarkdown(`**Ongoing reviews:**
- [first project](https://slack/ts1)
- [second project](https://slack/ts2)`),
    );
  });

  it('should put reviews waiting for the user first, then their own merge requests', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const gitlabUsername = 'john.doe';
    const body = {
      channel_id: channelId,
      text: 'review list',
      user_id: userId,
    };
    const reviewer = mergeRequestReviewersFixture[0].user;
    const john = { ...reviewer, username: gitlabUsername };
    const otherAuthor = { ...reviewer, username: 'other.author' };

    // Same iid in two projects, to check that each one gets its own permalink.
    const reviews = [
      { projectId: 1, mergeRequestIid: 1, ts: 'ts1', title: 'authored' },
      { projectId: 1, mergeRequestIid: 2, ts: 'ts2', title: 'to review' },
      {
        projectId: 2,
        mergeRequestIid: 1,
        ts: 'ts3',
        title: 'already approved',
      },
      { projectId: 2, mergeRequestIid: 2, ts: 'ts4', title: 'not a reviewer' },
    ];
    const reviewersByTitle: Record<string, unknown[]> = {
      authored: [],
      'to review': [{ state: 'unreviewed', user: john }],
      'already approved': [{ state: 'approved', user: john }],
      'not a reviewer': [{ state: 'unreviewed', user: reviewer }],
    };

    for (const { projectId, mergeRequestIid, ts, title } of reviews) {
      await addReviewToChannel({ channelId, mergeRequestIid, projectId, ts });
      mockGitlabCall(
        `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
        {
          ...mergeRequestDetailsFixture,
          author: title === 'authored' ? john : otherAuthor,
          iid: mergeRequestIid,
          title,
        },
      );
      mockGitlabCall(
        `/projects/${projectId}/merge_requests/${mergeRequestIid}/reviewers`,
        reviewersByTitle[title],
      );
    }

    (slackBotWebClient.users.info as jest.Mock).mockResolvedValue({
      user: {
        ...slackUserFixture,
        profile: {
          ...slackUserFixture.profile,
          email: `${gitlabUsername}@${CONFIG.slack.emailDomains.split(',')[0]}`,
        },
      },
    });
    (slackBotWebClient.chat.getPermalink as jest.Mock).mockImplementation(
      ({ message_ts }: { message_ts: string }) => ({
        permalink: `https://slack/${message_ts}`,
      }),
    );

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.users.info).toHaveBeenCalledWith({ user: userId });
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
      blocks: [
        {
          text: {
            text: slackifyMarkdown(`**Waiting for your review:**
- [to review](https://slack/ts2)

**Your merge requests:**
- [authored](https://slack/ts1)

**Other reviews:**
- [already approved](https://slack/ts3)
- [not a reviewer](https://slack/ts4)`),
            type: 'mrkdwn',
          },
          type: 'section',
        },
      ],
      channel: 'channelId',
      text: 'Ongoing reviews: to review, authored, already approved, not a reviewer.',
      user: 'userId',
    });
  });

  it('should fall back to a non-personalized list when the slack user lookup fails', async () => {
    // Given
    const channelId = 'channelId';
    const projectId = 1;
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'review list',
      user_id: userId,
    };

    await addReviewToChannel({
      channelId,
      mergeRequestIid: 1,
      projectId,
      ts: 'ts',
    });
    mockGitlabCall(
      `/projects/${projectId}/merge_requests/1`,
      mergeRequestDetailsFixture,
    );
    (slackBotWebClient.users.info as jest.Mock).mockRejectedValue(
      new Error('ratelimited'),
    );
    (slackBotWebClient.chat.getPermalink as jest.Mock).mockReturnValue({
      permalink: 'https://slack/ts',
    });

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Ongoing reviews: merge request title.',
      }),
    );
    expect(
      (slackBotWebClient.chat.postEphemeral as jest.Mock).mock.calls[0][0]
        .blocks[0].text.text,
    ).toEqual(
      slackifyMarkdown(`**Ongoing reviews:**
- [merge request title](https://slack/ts)`),
    );
  });

  it('should not list merge requests that are no longer open', async () => {
    // Given
    const channelId = 'channelId';
    const projectId = 1;
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'review list',
      user_id: userId,
    };
    const reviews = [
      { mergeRequestIid: 1, ts: 'ts1', state: 'opened', title: 'opened' },
      { mergeRequestIid: 2, ts: 'ts2', state: 'merged', title: 'merged' },
    ];

    for (const { mergeRequestIid, ts, state, title } of reviews) {
      await addReviewToChannel({ channelId, mergeRequestIid, projectId, ts });
      mockGitlabCall(
        `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
        {
          ...mergeRequestDetailsFixture,
          iid: mergeRequestIid,
          state,
          title,
        },
      );
    }
    (slackBotWebClient.chat.getPermalink as jest.Mock).mockImplementation(
      ({ message_ts }: { message_ts: string }) => ({
        permalink: `https://slack/${message_ts}`,
      }),
    );

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.getPermalink).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Ongoing reviews: opened.' }),
    );
  });

  it('should notify user when there is no review', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'review list',
      user_id: userId,
    };

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
      blocks: [
        {
          text: {
            text: 'There is no ongoing review shared in this channel :homer-metal:',
            type: 'mrkdwn',
          },
          type: 'section',
        },
      ],
      channel: 'channelId',
      text: 'There is no ongoing review shared in this channel.',
      user: 'userId',
    });
  });
});
