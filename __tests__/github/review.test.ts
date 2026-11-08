import type { SectionBlock, StaticSelect } from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { addProjectToChannel, addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mockUrl } from '@root/__mocks__/fetch-mock';
import { githubPullRequestFixture } from '../__fixtures__/github/pullRequestFixture';
import { githubRepositoryFixture } from '../__fixtures__/github/repositoryFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGithubCall } from '../utils/mockGithubCall';
import { mockGithubReviewMessageCalls } from '../utils/mockGithubReviewMessageCalls';

const channelId = 'channelId';
const userId = 'userId';
const { full_name, html_url, id: projectId } = githubRepositoryFixture;
const { number: iid } = githubPullRequestFixture;

async function sendCommand(text: string) {
  const body = { channel_id: channelId, text, user_id: userId };
  return request(app)
    .post('/api/v1/homer/command')
    .set(getSlackHeaders(body))
    .send(body);
}

export const githubReviewMessageFixture = {
  channel: channelId,
  link_names: true,
  text: `${githubPullRequestFixture.title} ${githubPullRequestFixture.html_url}`,
  username: 'author.real',
  icon_url: 'image_72',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${githubPullRequestFixture.html_url}|${githubPullRequestFixture.title}>*`,
      },
      accessory: {
        type: 'overflow',
        action_id: 'review-message-actions',
        options: [
          {
            text: { type: 'plain_text', text: 'Create a pipeline' },
            value: `review-create-pipeline~~github:${projectId}~~feat/github`,
          },
          {
            text: { type: 'plain_text', text: 'Rebase source branch' },
            value: `review-rebase-source-branch~~github:${projectId}~~${iid}`,
          },
          {
            text: { type: 'plain_text', text: 'Delete message' },
            value: 'review-delete-message',
          },
        ],
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Project: :github: _<${html_url}|${full_name}>_`,
        },
        { type: 'mrkdwn', text: 'Target branch: `main`' },
        { type: 'mrkdwn', text: 'Open discussion(s): `5`' },
        { type: 'mrkdwn', text: 'Changes: `7`' },
        { type: 'mrkdwn', text: 'Pipeline: ⏳ running' },
        { type: 'mrkdwn', text: 'Mergeable: ✅ Yes' },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Participants*\n @assignee @reviewer' },
        { type: 'mrkdwn', text: '*Approvals*\n 1/2 required ⏳' },
        { type: 'mrkdwn', text: '*Approved by*\n @approver' },
      ],
    },
  ],
};

describe('github > review', () => {
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
            profile: { image_72: 'image_72' },
            real_name: `${name}.real`,
          },
        });
      },
    );
  });

  it('should share a pull request found by text', async () => {
    // Given
    await addProjectToChannel({ channelId, projectId, provider: 'github' });
    mockGithubReviewMessageCalls();
    mockGithubCall(
      `/search/issues?q=${encodeURIComponent(
        `github is:pr is:open repo:${full_name}`,
      )}&per_page=20`,
      {
        items: [
          {
            number: iid,
            repository_url: `https://api.github.com/repos/${full_name}`,
          },
        ],
      },
    );

    // When
    const response = await sendCommand('review github');

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      githubReviewMessageFixture,
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: iid,
        projectId,
        provider: 'github',
        ts: 'ts',
      }),
    ).toEqual(true);
  });

  it('should share a pull request found by number', async () => {
    // Given
    await addProjectToChannel({ channelId, projectId, provider: 'github' });
    mockGithubReviewMessageCalls();

    // When
    await sendCommand(`review #${iid}`);

    // Then
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      githubReviewMessageFixture,
    );
  });

  it('should share a pull request found by URL outside channel projects', async () => {
    // Given
    mockGithubReviewMessageCalls();

    // When
    await sendCommand(`review ${githubPullRequestFixture.html_url}`);

    // Then
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      githubReviewMessageFixture,
    );
  });

  it('should ignore closed pull requests', async () => {
    // Given
    await addProjectToChannel({ channelId, projectId, provider: 'github' });
    mockGithubReviewMessageCalls({
      ...githubPullRequestFixture,
      state: 'closed',
    });

    // When
    await sendCommand(`review ${iid}`);

    // Then
    expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        text: `No merge request matches \`${iid}\` :homer-stressed:`,
      }),
    );
  });

  it('should let the user pick among GitHub and GitLab results', async () => {
    // Given
    const other = {
      ...githubRepositoryFixture,
      id: projectId + 1,
      full_name: 'homer-org/other',
    };
    await addProjectToChannel({ channelId, projectId, provider: 'github' });
    await addProjectToChannel({
      channelId,
      projectId: other.id,
      provider: 'github',
    });
    mockGithubReviewMessageCalls();
    mockGithubCall(`/repositories/${other.id}`, other);
    mockGithubCall(`/repos/${other.full_name}/pulls/${iid}`, {
      ...githubPullRequestFixture,
      title: 'other',
      base: { ...githubPullRequestFixture.base, repo: other },
    });

    // When
    await sendCommand(`review ${iid}`);

    // Then
    const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
      .calls[0][0].blocks[0] as SectionBlock;
    const { action_id, options } = block.accessory as StaticSelect;
    expect(options?.map(({ value }) => value)).toEqual([
      `merge-request~~github:${projectId}~~${iid}`,
      `merge-request~~github:${other.id}~~${iid}`,
    ]);

    // When
    const body = {
      payload: JSON.stringify({
        actions: [{ action_id, selected_option: options?.[0] }],
        container: { channel_id: channelId },
        response_url: 'https://slack/response',
        type: 'block_actions',
        user: { id: userId },
      }),
    };
    mockUrl('https://slack/response', {});
    await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      githubReviewMessageFixture,
    );
  });

  it('should list GitHub reviews', async () => {
    // Given
    await addReviewToChannel({
      channelId,
      mergeRequestIid: iid,
      projectId,
      provider: 'github',
      ts: 'ts',
    });
    mockGithubReviewMessageCalls();
    (slackBotWebClient.chat.getPermalink as jest.Mock).mockResolvedValue({
      permalink: 'https://slack/permalink',
    });

    // When
    await sendCommand('review list');

    // Then
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        text: `Ongoing reviews: ${githubPullRequestFixture.title}.`,
      }),
    );
  });
});
