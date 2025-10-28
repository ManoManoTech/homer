import type { SectionBlock, StaticSelect } from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { createRelease, updateRelease } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { mockUrl } from '@root/__mocks__/fetch-mock';
import { deploymentFixture } from '@root/__tests__/__fixtures__/deploymentFixture';
import { pipelineFixture } from '@root/__tests__/__fixtures__/pipelineFixture';
import { projectFixture } from '@root/__tests__/__fixtures__/projectFixture';
import { releaseFixture } from '@root/__tests__/__fixtures__/releaseFixture';
import { getReleaseCompletedMessageFixture } from '@root/__tests__/__fixtures__/releaseMessage';
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

describe('release > endRelease', () => {
  it('should end a release in monitoring state', async () => {
    // Given
    const projectId = projectFixture.id;
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(projectId);
    const channelId = releaseConfig.releaseChannelId;
    const userId = initialMockRelease.slackAuthor.id;
    let body: any = {
      channel_id: channelId,
      text: 'release end',
      user_id: userId,
    };

    await createRelease(initialMockRelease);

    mockGitlabCall(`/projects/${projectId}`, projectFixture);

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

    expect(block?.text?.text).toContain('Choose a release to end:');
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

    mockGitlabCall(
      `/projects/${projectId}/pipelines?ref=${releaseFixture.tag_name}`,
      [pipelineFixture],
    );

    // When
    response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    releaseConfig.notificationChannelIds.forEach(
      (notificationChannelId, index) => {
        expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
          index + 1,
          {
            blocks: [
              {
                text: {
                  text: `:ccheck: ${projectFixture.path} PRD - <${pipelineFixture.web_url}|pipeline> - <${projectFixture.web_url}/-/releases/${releaseFixture.tag_name}|release notes>`,
                  type: 'mrkdwn',
                },
                type: 'section',
              },
            ],
            channel: notificationChannelId,
            icon_url: 'image_72',
            link_names: true,
            text: ':ccheck: diaspora-project-site PRD',
            username: 'real_name',
          },
        );
      },
    );
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', { tagName: releaseFixture.tag_name }),
    ).toEqual(false);
  });

  it('end release button from release message should end release', async () => {
    // Given
    const releaseConfig = await ConfigHelper.getProjectReleaseConfig(
      initialMockRelease.projectId,
    );
    const createdRelease = await createRelease(initialMockRelease);
    await updateRelease(
      createdRelease.projectId,
      createdRelease.tagName,
      () => ({
        ts: 'timestamp',
      }),
    );

    mockGitlabCall(`/projects/${initialMockRelease.projectId}`, projectFixture);
    mockGitlabCall(
      `/projects/${initialMockRelease.projectId}/pipelines?ref=${releaseFixture.tag_name}`,
      [pipelineFixture],
    );

    // When
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [
          {
            action_id: 'release-button-end-action',
            block_id: '1Cj9B',
            text: {
              type: 'plain_text',
              text: 'Validate &amp; End Release',
              emoji: true,
            },
            value: `release~~${createdRelease.projectId}~~${createdRelease.tagName}`,
            style: 'primary',
            type: 'button',
            action_ts: '1761587005.541595',
          },
        ],
      }),
    };

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    expect(response.status).toEqual(HTTP_STATUS_OK);

    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    releaseConfig.notificationChannelIds.forEach(
      (notificationChannelId, index) => {
        expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
          index + 1,
          {
            blocks: [
              {
                text: {
                  text: `:ccheck: ${projectFixture.path} PRD - <${pipelineFixture.web_url}|pipeline> - <${projectFixture.web_url}/-/releases/${releaseFixture.tag_name}|release notes>`,
                  type: 'mrkdwn',
                },
                type: 'section',
              },
            ],
            channel: notificationChannelId,
            icon_url: 'image_72',
            link_names: true,
            text: ':ccheck: diaspora-project-site PRD',
            username: 'real_name',
          },
        );
      },
    );

    expect(slackBotWebClient.chat.update).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.update).toHaveBeenCalledWith(
      getReleaseCompletedMessageFixture(
        releaseConfig.releaseChannelId,
        deploymentFixture.ref,
        'timestamp',
        [
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `✅ *Integration:* Deployed successfully — started <!date^1619639400^at {time}|earlier>, finished <!date^1619639700^at {time}|now> (*took 5m 0s*)`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `✅ *Staging:* Deployed successfully — started <!date^1619639700^at {time}|earlier>, finished <!date^1619639880^at {time}|now> (*took 3m 0s*)`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `✅ *Production:* Deployed successfully — started <!date^1619639880^at {time}|earlier>, finished <!date^1619640180^at {time}|now> (*took 5m 0s*)`,
              },
            ],
          },
        ],
      ),
    );
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', { tagName: releaseFixture.tag_name }),
    ).toEqual(false);
  });
});
