import { SectionBlock, StaticSelect } from '@slack/web-api';
import * as nodeFetch from 'node-fetch';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { projectFixture } from '../__fixtures__/projectFixture';
import { fetch } from '../utils/fetch';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('project > removeProject', () => {
  it('should allow user to remove a project', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    let body = {
      channel_id: channelId,
      text: 'project remove',
      user_id: userId,
    } as Record<string, unknown>;

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
    let response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        blocks: expect.arrayContaining([]),
        channel: channelId,
        user: userId,
      })
    );

    const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
      .calls[0][0].blocks[0] as SectionBlock | undefined;

    expect(block?.text?.text).toEqual('Choose the project to remove:');
    expect(
      (block?.accessory as StaticSelect | undefined)?.options
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
    const nodeFetchSpy = jest.spyOn(nodeFetch, 'default');
    const { mockUrl } = (await import('node-fetch')) as any;
    mockUrl(responseUrl, { json: Promise.resolve('') });

    // When
    response = await fetch('/api/v1/homer/interactive', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      await hasModelEntry('Project', {
        channelId,
        projectId: projectFixture.id,
      })
    ).toEqual(false);
    expect(nodeFetchSpy).toHaveBeenLastCalledWith(
      responseUrl,
      expect.anything()
    ); // Deletes ephemeral message
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(2, {
      channel: channelId,
      text: expect.stringContaining(
        `\`${projectFixture.path_with_namespace}\` removed`
      ),
      user: userId,
    });
    nodeFetchSpy.mockRestore();
  });

  it('should notify user whether there is no project to remove', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'project remove',
      user_id: userId,
    } as Record<string, unknown>;

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        channel: channelId,
        text: 'This channel does not have any project.',
        user: userId,
      })
    );
  });
});
