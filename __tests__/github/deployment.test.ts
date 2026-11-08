import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { createRelease as createReleaseEntry } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { ReleaseState } from '@/release/typings/ReleaseState';
import ConfigHelper from '@/release/utils/ConfigHelper';
import githubReleaseManager from '@root/plugins/release/githubReleaseManager';
import { githubRepositoryFixture } from '../__fixtures__/github/repositoryFixture';
import { slackUserFixture } from '../__fixtures__/slackUserFixture';
import { getGithubHeaders } from '../utils/getGithubHeaders';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGithubCall } from '../utils/mockGithubCall';
import { waitFor } from '../utils/waitFor';

const { full_name, html_url, id: projectId } = githubRepositoryFixture;
const tagName = 'v1.1.0';

async function createRelease(state: ReleaseState) {
  await createReleaseEntry({
    description: '- change',
    failedDeployments: [],
    projectId,
    provider: 'github',
    slackAuthor: slackUserFixture,
    startedDeployments: [],
    state,
    successfulDeployments: [],
    tagName,
    ts: 'ts',
  });
}

async function sendDeploymentStatus(state: string, environment = 'production') {
  const body = {
    action: 'created',
    deployment: { ref: tagName, environment },
    deployment_status: {
      state,
      environment,
      created_at: '2026-01-01T10:00:00Z',
      target_url: `${html_url}/actions/runs/7`,
    },
    workflow_run: { html_url: `${html_url}/actions/runs/7` },
    repository: githubRepositoryFixture,
    sender: { id: 1, login: 'octocat', html_url: '' },
  };
  return request(app)
    .post('/api/v1/homer/github')
    .set(getGithubHeaders('deployment_status', body))
    .send(body);
}

describe('github > deployment', () => {
  beforeEach(() => {
    jest.spyOn(ConfigHelper, 'getProjectReleaseConfig').mockResolvedValue({
      notificationChannelIds: ['notificationChannelId'],
      projectId,
      provider: 'github',
      releaseChannelId: 'releaseChannelId',
      releaseManager: githubReleaseManager,
    });
    jest
      .spyOn(ConfigHelper, 'hasProjectReleaseConfig')
      .mockImplementation(
        async (id, provider) => id === projectId && provider === 'github',
      );
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should notify production deployments and monitor the release', async () => {
    // Given
    await createRelease('created');

    // When
    const response = await sendDeploymentStatus('success');

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    await waitFor(async () => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'notificationChannelId',
          text: ':mag: homer-repo PRD',
        }),
      );
      expect(
        await hasModelEntry('Release', {
          provider: 'github',
          tagName,
          state: 'monitoring',
        }),
      ).toEqual(true);
    });
    const notification = (
      slackBotWebClient.chat.postMessage as jest.Mock
    ).mock.calls.find(
      ([{ channel }]) => channel === 'notificationChannelId',
    )[0];
    expect(notification.blocks[0].text.text).toEqual(
      `:mag: homer-repo PRD - <${html_url}/actions/runs/7|pipeline> - <${html_url}/releases/tag/${tagName}|release notes>`,
    );
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'releaseChannelId' }),
    );
  });

  it('should ignore inactive deployments', async () => {
    // Given
    await createRelease('created');

    // When
    const response = await sendDeploymentStatus('inactive');

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('should ignore deployments of unknown releases', async () => {
    // When
    const response = await sendDeploymentStatus('in_progress');

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });

  it('should end a monitored release', async () => {
    // Given
    await createRelease('monitoring');
    const { updateRelease } = await import('@/core/services/data');
    await updateRelease(
      projectId,
      tagName,
      () => ({
        successfulDeployments: [
          { environment: 'production', date: '2026-01-01T10:00:00Z' },
        ],
      }),
      'github',
    );
    mockGithubCall(`/repositories/${projectId}`, githubRepositoryFixture);
    mockGithubCall(
      `/repos/${full_name}/actions/runs?per_page=100&branch=${tagName}`,
      { workflow_runs: [] },
    );
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [
          {
            action_id: 'release-button-end-action',
            value: `release~~github:${projectId}~~${tagName}`,
          },
        ],
        container: { channel_id: 'releaseChannelId' },
        user: { id: 'userId' },
      }),
    };

    // When
    await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    await waitFor(async () => {
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'notificationChannelId',
          text: ':ccheck: homer-repo PRD',
        }),
      );
      expect(
        await hasModelEntry('Release', { provider: 'github', tagName }),
      ).toEqual(false);
    });
  });
});
