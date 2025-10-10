import type { SectionBlock, StaticSelect } from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mockUrl } from '@root/__mocks__/fetch-mock';
import { projectFixture } from '../__fixtures__/projectFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('project > removeProject', () => {
  it('should allow user to remove a project', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    let body: Record<string, unknown> = {
      channel_id: channelId,
      text: 'project remove',
      user_id: userId,
    };

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
    });
    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id + 1,
    });
    mockGitlabCall(`/projects/${projectFixture.id}`, projectFixture);
    mockGitlabCall(`/projects/${projectFixture.id + 1}`, projectFixture);

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
        blocks: expect.arrayContaining([]),
        channel: channelId,
        user: userId,
      }),
    );

    const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
      .calls[0][0].blocks[0] as SectionBlock | undefined;

    expect(block?.text?.text).toEqual('Choose the project to remove:');
    expect(
      (block?.accessory as StaticSelect | undefined)?.options,
    ).toHaveLength(2);

    // Given
    const { action_id, options } = block?.accessory as StaticSelect;
    const responseUrl = 'https://slack/responseUrl';
    body = {
      payload: JSON.stringify({
        actions: [
          {
            action_id,
            selected_option: { value: options?.[0].value },
          },
        ],
        container: { channel_id: channelId },
        response_url: responseUrl,
        type: 'block_actions',
        user: { id: userId },
      }),
    };
    const mockCall = mockUrl(responseUrl, { json: Promise.resolve('') });
    // When
    response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      await hasModelEntry('Project', {
        channelId,
        projectId: projectFixture.id,
      }),
    ).toEqual(false);
    expect(mockCall.called).toBeTruthy(); // Deletes ephemeral message
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(2, {
      channel: channelId,
      text: expect.stringContaining(
        `\`${projectFixture.path_with_namespace}\` removed`,
      ),
      user: userId,
    });
  });

  it('should notify user whether there is no project to remove', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body: Record<string, unknown> = {
      channel_id: channelId,
      text: 'project remove',
      user_id: userId,
    };

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        channel: channelId,
        text: 'This channel does not have any project.',
        user: userId,
      }),
    );
  });
});
