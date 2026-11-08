import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import { githubPullRequestFixture } from '../__fixtures__/github/pullRequestFixture';
import { githubRepositoryFixture } from '../__fixtures__/github/repositoryFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGithubCall } from '../utils/mockGithubCall';

const channelId = 'channelId';
const userId = 'userId';
const { full_name, id: projectId } = githubRepositoryFixture;
const repo = `/repos/${full_name}`;

async function selectAction(value: string) {
  const body = {
    payload: JSON.stringify({
      actions: [
        { action_id: 'review-message-actions', selected_option: { value } },
      ],
      channel: { id: channelId },
      message: { ts: 'ts' },
      type: 'block_actions',
      user: { id: userId },
    }),
  };
  return request(app)
    .post('/api/v1/homer/interactive')
    .set(getSlackHeaders(body))
    .send(body);
}

describe('github > review actions', () => {
  beforeEach(() => {
    mockGithubCall(`/repositories/${projectId}`, githubRepositoryFixture);
  });

  it('should re-run the latest workflow runs of the branch head', async () => {
    // Given
    const branch = githubPullRequestFixture.head.ref;
    mockGithubCall(
      `${repo}/actions/runs?per_page=100&branch=${encodeURIComponent(branch)}`,
      {
        workflow_runs: [
          { id: 30, workflow_id: 1, head_sha: 'new' },
          { id: 20, workflow_id: 2, head_sha: 'new' },
          { id: 10, workflow_id: 1, head_sha: 'new' },
          { id: 5, workflow_id: 3, head_sha: 'old' },
        ],
      },
    );
    const rerun30 = mockGithubCall(`${repo}/actions/runs/30/rerun`, {});
    const rerun20 = mockGithubCall(`${repo}/actions/runs/20/rerun`, {});
    const rerun10 = mockGithubCall(`${repo}/actions/runs/10/rerun`, {});

    // When
    const response = await selectAction(
      `review-create-pipeline~~github:${projectId}~~${branch}`,
    );

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(rerun30.called).toBe(true);
    expect(rerun20.called).toBe(true);
    expect(rerun10.called).toBe(false);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
      channel: channelId,
      text: 'Pipeline created :homer-happy:',
      user: userId,
    });
  });

  it('should update the pull request branch', async () => {
    // Given
    const { number } = githubPullRequestFixture;
    const updateBranch = mockGithubCall(
      `${repo}/pulls/${number}/update-branch`,
      { message: 'Updating pull request branch.' },
      202,
    );

    // When
    const response = await selectAction(
      `review-rebase-source-branch~~github:${projectId}~~${number}`,
    );

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(updateBranch.calledWith?.[1]).toEqual(
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
      channel: channelId,
      text: 'Rebase in progress :homer-donut:',
      user: userId,
    });
  });
});
