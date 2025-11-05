import type { SectionBlock, StaticSelect } from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import {
  createRelease,
  getProjectRelease,
  updateRelease,
} from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { mockUrl } from '@root/__mocks__/fetch-mock';
import { pipelineFixture } from '@root/__tests__/__fixtures__/pipelineFixture';
import { projectFixture } from '@root/__tests__/__fixtures__/projectFixture';
import { releaseFixture } from '@root/__tests__/__fixtures__/releaseFixture';
import { getReleaseCanceledMessageFixture } from '@root/__tests__/__fixtures__/releaseMessage';
import { slackUserFixture } from '@root/__tests__/__fixtures__/slackUserFixture';
import { getSlackHeaders } from '@root/__tests__/utils/getSlackHeaders';
import { mockGitlabCall } from '@root/__tests__/utils/mockGitlabCall';

const initialMockRelease: DataRelease = {
  description:
    '- [feat(great): implement great feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-156](https://my-ticket-management.com/view/SPAR-156)\n- [feat(great): implement another great feature](http://gitlab.example.com/my-group/my-project/-/merge_requests/1) - [SPAR-158](https://my-ticket-management.com/view/SPAR-158)',
  failedDeployments: [],
  projectId: projectFixture.id,
  slackAuthor: slackUserFixture,
  startedDeployments: [
    { environment: 'integration', date: '2021-04-28 21:50:00 +0200' },
    { environment: 'staging', date: '2021-04-28 21:55:00 +0200' },
    { environment: 'production', date: '2021-04-28 21:58:00 +0200' },
  ],
  state: 'monitoring',
  successfulDeployments: [
    { environment: 'integration', date: '2021-04-28 21:55:00 +0200' },
    { environment: 'staging', date: '2021-04-28 21:58:00 +0200' },
    { environment: 'production', date: '2021-04-28 22:03:00 +0200' },
  ],
  tagName: releaseFixture.tag_name,
};

describe('release > cancelRelease', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should cancel a release in created state', async () => {
    // Given
    const createdRelease: DataRelease = {
      ...initialMockRelease,
      state: 'created',
      startedDeployments: [],
      successfulDeployments: [],
    };

    const projectId = createdRelease.projectId;
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(projectId);
    const channelId = releaseConfig.releaseChannelId;
    const userId = createdRelease.slackAuthor.id;

    await createRelease(createdRelease);
    await updateRelease(
      createdRelease.projectId,
      createdRelease.tagName,
      () => ({
        ts: 'timestamp',
      }),
    );

    mockGitlabCall(`/projects/${projectId}`, projectFixture);
    mockGitlabCall(
      `/projects/${projectId}/releases/${createdRelease.tagName}`,
      releaseFixture,
    );
    mockGitlabCall(
      `/projects/${projectId}/pipelines?ref=${createdRelease.tagName}`,
      [pipelineFixture],
    );
    mockGitlabCall(
      `/projects/${projectId}/pipelines/${pipelineFixture.id}/cancel`,
      pipelineFixture,
    );

    // When - Simulate clicking the cancel button
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [
          {
            action_id: 'release-button-cancel-action',
            value: `release~~${projectId}~~${createdRelease.tagName}`,
          },
        ],
        container: { channel_id: channelId },
        user: { id: userId },
      }),
    };

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);

    // Check that the release was removed
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', { tagName: createdRelease.tagName }),
    ).toEqual(false);

    // Check that the UI was updated
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseCanceledMessageFixture(
        releaseConfig.releaseChannelId,
        createdRelease.tagName,
        'timestamp',
      ),
    );

    // Check that notification was sent
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(
      releaseConfig.notificationChannelIds.length,
    );
    releaseConfig.notificationChannelIds.forEach(
      (notificationChannelId, index) => {
        expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
          index + 1,
          {
            blocks: [
              {
                text: {
                  text: `:homer: Release <${projectFixture.web_url}/-/releases/${releaseFixture.tag_name}|${releaseFixture.tag_name}> canceled and marked as not deployed :homer-donut:`,
                  type: 'mrkdwn',
                },
                type: 'section',
              },
            ],
            channel: notificationChannelId,
            icon_url: 'image_72',
            text: `Release <${projectFixture.web_url}/-/releases/${releaseFixture.tag_name}|${releaseFixture.tag_name}> canceled and marked as not deployed.`,
            username: 'real_name',
          },
        );
      },
    );
  });

  it('should cancel a legacy release in created state', async () => {
    // Given
    const createdRelease: DataRelease = {
      ...initialMockRelease,
      state: 'created',
      startedDeployments: [],
      successfulDeployments: [],
    };

    const projectId = createdRelease.projectId;
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(projectId);
    const channelId = releaseConfig.releaseChannelId;
    const userId = createdRelease.slackAuthor.id;

    await createRelease(createdRelease);

    mockGitlabCall(`/projects/${projectId}`, projectFixture);
    mockGitlabCall(
      `/projects/${projectId}/releases/${createdRelease.tagName}`,
      releaseFixture,
    );
    mockGitlabCall(
      `/projects/${projectId}/pipelines?ref=${createdRelease.tagName}`,
      [pipelineFixture],
    );
    mockGitlabCall(
      `/projects/${projectId}/pipelines/${pipelineFixture.id}/cancel`,
      pipelineFixture,
    );

    // When - Simulate clicking the cancel button
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [
          {
            action_id: 'release-button-cancel-action',
            value: `release~~${projectId}~~${createdRelease.tagName}`,
          },
        ],
        container: { channel_id: channelId },
        user: { id: userId },
      }),
    };

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);

    // Check that the release was removed
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', { tagName: createdRelease.tagName }),
    ).toEqual(false);

    // Check that the UI was not updated
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(0);

    // Check that notification was sent
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(2);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(1, {
      blocks: [
        {
          text: {
            text: `:homer: Release <${projectFixture.web_url}/-/releases/${releaseFixture.tag_name}|${releaseFixture.tag_name}> canceled and marked as not deployed :homer-donut:`,
            type: 'mrkdwn',
          },
          type: 'section',
        },
      ],
      channel: 'C0XXXXXXXXX',
      icon_url: 'image_72',
      text: `Release <${projectFixture.web_url}/-/releases/${releaseFixture.tag_name}|${releaseFixture.tag_name}> canceled and marked as not deployed.`,
      username: 'real_name',
    });
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      2,
      getReleaseCanceledMessageFixture(
        releaseConfig.releaseChannelId,
        createdRelease.tagName,
        undefined,
      ),
    );
  });

  it('should cancel a release in notYetReady state', async () => {
    // Given
    const notYetReadyRelease: DataRelease = {
      ...initialMockRelease,
      state: 'notYetReady',
      startedDeployments: [],
      successfulDeployments: [],
    };

    const projectId = notYetReadyRelease.projectId;
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(projectId);
    const channelId = releaseConfig.releaseChannelId;
    const userId = notYetReadyRelease.slackAuthor.id;

    await createRelease(notYetReadyRelease);
    await updateRelease(
      notYetReadyRelease.projectId,
      notYetReadyRelease.tagName,
      () => ({
        ts: 'timestamp',
      }),
    );

    mockGitlabCall(`/projects/${projectId}`, projectFixture);

    // When - Simulate clicking the cancel button
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [
          {
            action_id: 'release-button-cancel-action',
            value: `release~~${projectId}~~${notYetReadyRelease.tagName}`,
          },
        ],
        container: { channel_id: channelId },
        user: { id: userId },
      }),
    };

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);

    // Check that the release was removed
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', { tagName: notYetReadyRelease.tagName }),
    ).toEqual(false);

    // Check that the UI was updated
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseCanceledMessageFixture(
        releaseConfig.releaseChannelId,
        notYetReadyRelease.tagName,
        'timestamp',
      ),
    );
  });

  it('should cancel a legacy release in notYetReady state', async () => {
    // Given
    const notYetReadyRelease: DataRelease = {
      ...initialMockRelease,
      state: 'notYetReady',
      startedDeployments: [],
      successfulDeployments: [],
    };

    const projectId = notYetReadyRelease.projectId;
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(projectId);
    const channelId = releaseConfig.releaseChannelId;
    const userId = notYetReadyRelease.slackAuthor.id;

    await createRelease(notYetReadyRelease);

    mockGitlabCall(`/projects/${projectId}`, projectFixture);

    // When - Simulate clicking the cancel button
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [
          {
            action_id: 'release-button-cancel-action',
            value: `release~~${projectId}~~${notYetReadyRelease.tagName}`,
          },
        ],
        container: { channel_id: channelId },
        user: { id: userId },
      }),
    };

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);

    // Check that the release was removed
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', { tagName: notYetReadyRelease.tagName }),
    ).toEqual(false);

    // Check that the UI was not updated
    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(0);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith(
      getReleaseCanceledMessageFixture(
        releaseConfig.releaseChannelId,
        notYetReadyRelease.tagName,
        undefined,
      ),
    );
  });

  it('should not cancel a release in monitoring state', async () => {
    // Given
    const monitoringRelease: DataRelease = {
      ...initialMockRelease,
      state: 'monitoring',
    };

    const projectId = monitoringRelease.projectId;
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(projectId);
    const channelId = releaseConfig.releaseChannelId;
    const userId = monitoringRelease.slackAuthor.id;

    await createRelease(monitoringRelease);

    mockGitlabCall(`/projects/${projectId}`, projectFixture);

    // When - Simulate clicking the cancel button
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [
          {
            action_id: 'release-button-cancel-action',
            value: `release~~${projectId}~~${monitoringRelease.tagName}`,
          },
        ],
        container: { channel_id: channelId },
        user: { id: userId },
      }),
    };

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);

    // Check that the release still exists
    const release = await getProjectRelease(
      projectId,
      monitoringRelease.tagName,
    );
    expect(release).not.toBeUndefined();
    expect(release?.state).toEqual('monitoring');

    // Check that an ephemeral message was sent
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
      channel: channelId,
      user: userId,
      text: 'It is too late to cancel that release :homer-stressed:',
    });

    // Check that the UI was not updated
    expect(slackBotWebClient.chat.update).not.toHaveBeenCalled();
  });

  it('should cancel a release through the command interface', async () => {
    // Given
    const notYetReadyRelease: DataRelease = {
      ...initialMockRelease,
      state: 'notYetReady',
      startedDeployments: [],
      successfulDeployments: [],
    };

    const projectId = notYetReadyRelease.projectId;
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(projectId);
    const channelId = releaseConfig.releaseChannelId;
    const userId = notYetReadyRelease.slackAuthor.id;

    await createRelease(notYetReadyRelease);
    await updateRelease(
      notYetReadyRelease.projectId,
      notYetReadyRelease.tagName,
      () => ({
        ts: 'timestamp',
      }),
    );

    mockGitlabCall(`/projects/${projectId}`, projectFixture);

    let body: any = {
      channel_id: channelId,
      text: 'release cancel',
      user_id: userId,
    };

    // When
    let response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        blocks: expect.any(Array),
        channel: channelId,
        user: userId,
      }),
    );

    const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
      .calls[0][0].blocks[0] as SectionBlock | undefined;

    expect(block?.text?.text).toContain('Choose a release to cancel:');
    expect(
      (block?.accessory as StaticSelect | undefined)?.option_groups,
    ).toHaveLength(1);

    // Given
    const { action_id, option_groups } = block?.accessory as StaticSelect;
    const responseUrl = 'https://slack/responseUrl';
    body = {
      payload: JSON.stringify({
        actions: [
          {
            action_id,
            selected_option: { value: option_groups?.[0].options?.[0].value },
          },
        ],
        container: { channel_id: channelId },
        response_url: responseUrl,
        type: 'block_actions',
        user: { id: userId },
      }),
    };
    mockUrl(responseUrl, { json: Promise.resolve('') });

    // When
    response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);

    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', { tagName: releaseFixture.tag_name }),
    ).toEqual(false);

    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseCanceledMessageFixture(
        releaseConfig.releaseChannelId,
        notYetReadyRelease.tagName,
        'timestamp',
      ),
    );
  });
});
