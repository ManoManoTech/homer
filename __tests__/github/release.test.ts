import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { createRelease as createReleaseEntry } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import ConfigHelper from '@/release/utils/ConfigHelper';
import githubReleaseManager from '@root/plugins/release/githubReleaseManager';
import { githubRepositoryFixture } from '../__fixtures__/github/repositoryFixture';
import { slackUserFixture } from '../__fixtures__/slackUserFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGithubCall } from '../utils/mockGithubCall';
import { waitFor } from '../utils/waitFor';

const { full_name, html_url, id: projectId } = githubRepositoryFixture;
const repo = `/repos/${full_name}`;
const releaseChannelId = 'releaseChannelId';
const tagName = 'v1.1.0';

const releaseConfig: ProjectReleaseConfig = {
  notificationChannelIds: ['notificationChannelId'],
  projectId,
  provider: 'github',
  releaseChannelId,
  releaseManager: githubReleaseManager,
  hasReleasePipeline: true,
};

function run(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `workflow ${id}`,
    workflow_id: id,
    head_branch: 'main',
    head_sha: 'mainsha',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    html_url: `${html_url}/actions/runs/${id}`,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('github > release', () => {
  beforeEach(() => {
    jest
      .spyOn(ConfigHelper, 'getProjectReleaseConfig')
      .mockImplementation(async (id, provider) => {
        if (id !== projectId || provider !== 'github') {
          throw new Error(`Unexpected config lookup ${provider}:${id}`);
        }
        return releaseConfig;
      });
    jest
      .spyOn(ConfigHelper, 'hasProjectReleaseConfig')
      .mockImplementation(
        async (id, provider) => id === projectId && provider === 'github',
      );
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });
    (slackBotWebClient.users.info as jest.Mock).mockResolvedValue({
      user: slackUserFixture,
    });
    mockGithubCall(`/repositories/${projectId}`, githubRepositoryFixture);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a GitHub release once the default branch workflows succeeded', async () => {
    // Given
    mockGithubCall(`${repo}/compare/v1.0.0...main?per_page=100&page=1`, {
      commits: [
        {
          sha: 's1',
          html_url: `${html_url}/commit/s1`,
          commit: { message: 'feat: new (#4)', author: null, committer: null },
        },
      ],
    });
    mockGithubCall(`${repo}/actions/runs?per_page=100&branch=main`, {
      workflow_runs: [run(2), run(1), run(0, { head_sha: 'oldsha' })],
    });
    mockGithubCall(`${repo}/actions/runs/2`, run(2));
    mockGithubCall(`${repo}/git/ref/tags/v1.0.0`, { ref: 'refs/tags/v1.0.0' });
    const releaseCall = mockGithubCall(`${repo}/releases`, { id: 1 });
    mockGithubCall(`${repo}/actions/runs?per_page=100&branch=${tagName}`, {
      workflow_runs: [run(3, { head_branch: tagName })],
    });

    const body = {
      payload: JSON.stringify({
        type: 'view_submission',
        user: { id: 'userId' },
        view: {
          callback_id: 'release-create-modal',
          state: {
            values: {
              'release-project-block': {
                'release-select-project-action': {
                  selected_option: { value: `github:${projectId}` },
                },
              },
              'release-previous-tag-block': {
                'release-select-previous-tag-action': {
                  selected_option: { value: 'v1.0.0' },
                },
              },
              'release-tag-block': { 'release-tag-action': { value: tagName } },
            },
          },
        },
      }),
    };

    // When
    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    await waitFor(() => {
      expect(releaseCall.called).toBe(true);
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalled();
    });
    expect(JSON.parse(releaseCall.calledWith?.[1]?.body as string)).toEqual({
      tag_name: tagName,
      target_commitish: 'mainsha',
      name: tagName,
      body: `- [feat: new](${html_url}/pull/4)`,
    });

    const message = (slackBotWebClient.chat.postMessage as jest.Mock).mock
      .calls[0][0];
    expect(message.channel).toEqual(releaseChannelId);
    expect(JSON.stringify(message.blocks)).toContain(
      `${html_url}/releases/tag/${tagName}|${tagName}`,
    );
    expect(JSON.stringify(message.blocks)).toContain(
      `${html_url}/actions/runs/3`,
    );
    expect(JSON.stringify(message.blocks)).toContain(
      `release~~github:${projectId}~~${tagName}`,
    );

    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', {
        projectId,
        provider: 'github',
        tagName,
        state: 'created',
      }),
    ).toEqual(true);
  });

  it('should not be ready while a default branch workflow is running', async () => {
    // Given
    mockGithubCall(`${repo}/actions/runs/2`, run(2));
    mockGithubCall(`${repo}/actions/runs?per_page=100&branch=main`, {
      workflow_runs: [
        run(2),
        run(1, { status: 'in_progress', conclusion: null }),
      ],
    });
    const { default: getReleaseOptions } = await import(
      '@/release/releaseOptions'
    );

    // When
    const isReady = await githubReleaseManager.isReadyToRelease(
      { projectId } as never,
      2,
      getReleaseOptions(),
    );

    // Then
    expect(isReady).toBe(false);
  });

  it('should cancel a created GitHub release', async () => {
    // Given
    await createReleaseEntry({
      description: '',
      failedDeployments: [],
      projectId,
      provider: 'github',
      slackAuthor: slackUserFixture,
      startedDeployments: [],
      state: 'created',
      successfulDeployments: [],
      tagName,
      ts: 'ts',
    });
    mockGithubCall(`${repo}/releases/tags/${tagName}`, {
      id: 42,
      tag_name: tagName,
      name: tagName,
      body: '',
    });
    const updateCall = mockGithubCall(`${repo}/releases/42`, { id: 42 });
    mockGithubCall(`${repo}/actions/runs?per_page=100&branch=${tagName}`, {
      workflow_runs: [run(3, { head_branch: tagName })],
    });
    const cancelCall = mockGithubCall(`${repo}/actions/runs/3/cancel`, {});

    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [
          {
            action_id: 'release-button-cancel-action',
            value: `release~~github:${projectId}~~${tagName}`,
          },
        ],
        container: { channel_id: releaseChannelId },
        user: { id: 'userId' },
      }),
    };

    // When
    await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    await waitFor(() => {
      expect(cancelCall.called).toBe(true);
      expect(updateCall.called).toBe(true);
    });
    expect(JSON.parse(updateCall.calledWith?.[1]?.body as string)).toEqual({
      name: `[NOT DEPLOYED] ${tagName}`,
    });
    await waitFor(() =>
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'notificationChannelId',
          text: `Release <${html_url}/releases/tag/${tagName}|${tagName}> canceled and marked as not deployed.`,
        }),
      ),
    );
  });
});
