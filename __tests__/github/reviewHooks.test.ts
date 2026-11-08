import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel, addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import {
  githubApproverFixture,
  githubAuthorFixture,
  githubPullRequestFixture,
} from '../__fixtures__/github/pullRequestFixture';
import { githubRepositoryFixture } from '../__fixtures__/github/repositoryFixture';
import { getGithubHeaders } from '../utils/getGithubHeaders';
import { mockGithubCall } from '../utils/mockGithubCall';
import { mockGithubReviewMessageCalls } from '../utils/mockGithubReviewMessageCalls';
import { waitFor } from '../utils/waitFor';

const channelId = 'channelId';
const { full_name, id: projectId } = githubRepositoryFixture;
const { number: iid } = githubPullRequestFixture;

async function sendHook(event: string, body: Record<string, unknown>) {
  const payload = { repository: githubRepositoryFixture, ...body };
  return request(app)
    .post('/api/v1/homer/github')
    .set(getGithubHeaders(event, payload))
    .send(payload);
}

async function addReview() {
  await addReviewToChannel({
    channelId,
    mergeRequestIid: iid,
    projectId,
    provider: 'github',
    ts: 'ts',
  });
}

describe('github > review hooks', () => {
  beforeEach(() => {
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      ({ email }: { email: string }) => {
        const name = email.split('@')[0];
        return Promise.resolve({
          user: {
            name,
            profile: { image_24: 'image_24', image_72: 'image_72' },
            real_name: `${name}.real`,
          },
        });
      },
    );
  });

  it('should share a pull request labeled homer-review', async () => {
    // Given
    await addProjectToChannel({ channelId, projectId, provider: 'github' });
    mockGithubReviewMessageCalls();

    // When
    const response = await sendHook('pull_request', {
      action: 'labeled',
      pull_request: {
        ...githubPullRequestFixture,
        labels: [{ name: 'homer-review' }],
      },
      sender: githubAuthorFixture,
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: channelId,
        text: `${githubPullRequestFixture.title} ${githubPullRequestFixture.html_url}`,
      }),
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: iid,
        projectId,
        provider: 'github',
      }),
    ).toEqual(true);
  });

  it('should share a pull request labeled homer-mergeable once only approvals are missing', async () => {
    // Given
    await addProjectToChannel({ channelId, projectId, provider: 'github' });
    mockGithubReviewMessageCalls({
      ...githubPullRequestFixture,
      mergeable_state: 'blocked',
    });

    // When
    const response = await sendHook('pull_request', {
      action: 'labeled',
      pull_request: {
        ...githubPullRequestFixture,
        labels: [{ name: 'homer-mergeable' }],
        mergeable_state: 'unknown',
      },
      sender: githubAuthorFixture,
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
  });

  it('should not share a pull request labeled homer-mergeable with conflicts', async () => {
    // Given
    await addProjectToChannel({ channelId, projectId, provider: 'github' });
    mockGithubReviewMessageCalls({
      ...githubPullRequestFixture,
      mergeable: false,
      mergeable_state: 'dirty',
    });

    // When
    const response = await sendHook('pull_request', {
      action: 'labeled',
      pull_request: {
        ...githubPullRequestFixture,
        labels: [{ name: 'homer-mergeable' }],
      },
      sender: githubAuthorFixture,
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('should post merges in thread and stop tracking the review', async () => {
    // Given
    await addReview();
    mockGithubReviewMessageCalls({
      ...githubPullRequestFixture,
      state: 'closed',
      merged: true,
    });

    // When
    const response = await sendHook('pull_request', {
      action: 'closed',
      pull_request: { ...githubPullRequestFixture, merged: true },
      sender: githubAuthorFixture,
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ts: 'ts',
        text: `~${githubPullRequestFixture.title}~ ${githubPullRequestFixture.html_url} (merged)`,
      }),
    );
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: channelId,
      icon_emoji: ':git-merge:',
      text: '*author.real* has merged this merge request.',
      thread_ts: 'ts',
    });
    expect(
      await hasModelEntry('Review', {
        mergeRequestIid: iid,
        provider: 'github',
      }),
    ).toEqual(false);
  });

  it('should stop tracking reviews merged by unmapped users', async () => {
    // Given
    const bot = {
      id: 99,
      login: 'merge-queue[bot]',
      html_url: 'https://github.com/apps/merge-queue',
    };
    await addReview();
    mockGithubReviewMessageCalls({
      ...githubPullRequestFixture,
      state: 'closed',
      merged: true,
    });
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockRejectedValue(
      new Error('users_not_found'),
    );

    // When
    const response = await sendHook('pull_request', {
      action: 'closed',
      pull_request: { ...githubPullRequestFixture, merged: true },
      sender: bot,
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    await waitFor(async () => {
      expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('(merged)'),
        }),
      );
      expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
      expect(
        await hasModelEntry('Review', {
          mergeRequestIid: iid,
          provider: 'github',
        }),
      ).toEqual(false);
    });
  });

  it('should post approvals and review comments in thread', async () => {
    // Given
    await addReview();
    mockGithubReviewMessageCalls();
    mockGithubCall(`/user/${githubApproverFixture.id}`, githubApproverFixture);
    jest.useFakeTimers();

    // When
    const response = await sendHook('pull_request_review', {
      action: 'submitted',
      pull_request: githubPullRequestFixture,
      review: {
        id: 3,
        user: githubApproverFixture,
        state: 'approved',
        body: 'LGTM',
        html_url: `${githubPullRequestFixture.html_url}#review-3`,
      },
      sender: githubApproverFixture,
    });
    await waitFor(() =>
      expect(slackBotWebClient.chat.update).toHaveBeenCalled(),
    );
    jest.runAllTimers();
    jest.useRealTimers();

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    await waitFor(() => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: channelId,
        icon_emoji: ':thumbsup_blue:',
        text: '*approver.real* has approved this merge request.',
        thread_ts: 'ts',
      });
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: channelId,
          thread_ts: 'ts',
          text: expect.stringContaining(':speech_balloon_blue: LGTM'),
        }),
      );
    });
  });

  it('should post pull request comments in thread', async () => {
    // Given
    await addReview();
    mockGithubReviewMessageCalls();
    mockGithubCall(`/user/${githubApproverFixture.id}`, githubApproverFixture);
    jest.useFakeTimers();

    // When
    const response = await sendHook('issue_comment', {
      action: 'created',
      issue: { number: iid, pull_request: {} },
      comment: {
        body: 'Nice catch',
        html_url: `${githubPullRequestFixture.html_url}#issuecomment-1`,
        user: githubApproverFixture,
      },
      sender: githubApproverFixture,
    });
    jest.runAllTimers();
    jest.useRealTimers();

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    await waitFor(() => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(':speech_balloon_blue: Nice catch'),
          thread_ts: 'ts',
        }),
      );
    });
  });

  it('should ignore issue comments', async () => {
    // When
    const response = await sendHook('issue_comment', {
      action: 'created',
      issue: { number: iid },
      comment: { body: 'hi', html_url: '', user: githubApproverFixture },
      sender: githubApproverFixture,
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should post pushed commits in thread', async () => {
    // Given
    await addReview();
    mockGithubCall(`/repositories/${projectId}`, githubRepositoryFixture);
    mockGithubCall(
      `/repos/${full_name}/pulls?state=open&head=${encodeURIComponent(
        `homer-org:${githubPullRequestFixture.head.ref}`,
      )}`,
      [githubPullRequestFixture],
    );
    mockGithubCall(`/repos/${full_name}/pulls/${iid}/commits?per_page=100`, [
      { sha: 'newsha' },
    ]);

    // When
    const response = await sendHook('push', {
      ref: `refs/heads/${githubPullRequestFixture.head.ref}`,
      commits: [
        {
          id: 'newsha',
          message: 'fix: <!channel> typo\n\nDetails',
          url: 'https://github.com/commit/newsha',
          author: { email: 'author@my-domain.com' },
          added: ['a'],
          modified: ['b', 'c'],
          removed: [],
        },
        {
          id: 'rebasedsha',
          message: 'chore: from main',
          url: 'https://github.com/commit/rebasedsha',
          author: { email: 'other@my-domain.com' },
        },
      ],
      sender: githubAuthorFixture,
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    await waitFor(() => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: channelId,
          thread_ts: 'ts',
          text: ':git-commit: New commit(s)',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '<https://github.com/commit/newsha|fix: &lt;!channel&gt; typo>',
              },
            },
            expect.objectContaining({ type: 'context' }),
          ],
        }),
      );
    });
  });
});
