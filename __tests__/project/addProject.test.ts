import type { SectionBlock, StaticSelect } from '@slack/web-api';
import * as nodeFetch from 'node-fetch';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { projectFixture } from '../__fixtures__/projectFixture';
import { fetch } from '../utils/fetch';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('project > addProject', () => {
  it('should add project by search', async () => {
    // Given
    const channelId = 'channelId';
    const search = 'search';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `project add ${search}`,
      user_id: userId,
    };

    mockGitlabCall(`/projects?search=${search}`, [projectFixture]);

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(
      await hasModelEntry('Project', {
        channelId,
        projectId: projectFixture.id,
      }),
    ).toEqual(true);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(
        `\`${projectFixture.path_with_namespace}\` added`,
      ),
      user: userId,
    });
  });

  it('should add project by web_url', async () => {
    // Given
    const { web_url, path } = projectFixture;
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `project add ${web_url}`,
      user_id: userId,
    };

    mockGitlabCall(`/projects?search=${path}`, [projectFixture]);

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(
      await hasModelEntry('Project', {
        channelId,
        projectId: projectFixture.id,
      }),
    ).toEqual(true);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(
        `\`${projectFixture.path_with_namespace}\` added`,
      ),
      user: userId,
    });
  });

  it('should add project by id', async () => {
    // Given
    const channelId = 'channelId';
    const projectId = projectFixture.id;
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `project add ${projectId}`,
      user_id: userId,
    };

    mockGitlabCall(`/projects/${projectId}`, projectFixture);

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(await hasModelEntry('Project', { channelId, projectId })).toEqual(
      true,
    );
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(
        `\`${projectFixture.path_with_namespace}\` added`,
      ),
      user: userId,
    });
  });

  it('should display help if no query', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'project add',
      user_id: userId,
    };

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });
    const json = (await response.json()) as any;

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(json.channel).toEqual(channelId);
    expect(json.blocks?.[0]?.text?.text).toContain('available commands');
  });

  it('should notify user whether no project found by name', async () => {
    // Given
    const channelId = 'channelId';
    const search = 'search';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `project add ${search}`,
      user_id: userId,
    };

    mockGitlabCall(`/projects?search=${search}`, []);

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(`No project matches \`${search}\``),
      user: userId,
    });
  });

  it('should notify user whether no project found by id', async () => {
    // Given
    const channelId = 'channelId';
    const projectId = projectFixture.id;
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `project add ${projectId}`,
      user_id: userId,
    };

    mockGitlabCall(`/projects/${projectId}`, {});

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(
        `No project found with id \`${projectId}\``,
      ),
      user: userId,
    });
  });

  it('should allow user to choose whether multiple projects are found', async () => {
    // Given
    const channelId = 'channelId';
    const search = 'search';
    const userId = 'userId';
    let body: Record<string, unknown> = {
      channel_id: channelId,
      text: `project add ${search}`,
      user_id: userId,
    };

    mockGitlabCall(`/projects?search=${search}`, [
      projectFixture,
      projectFixture,
    ]);

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
      }),
    );

    const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
      .calls[0][0].blocks[0] as SectionBlock | undefined;

    expect(block?.text?.text).toContain(
      `Multiple projects match \`${search}\``,
    );
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
      }),
    ).toEqual(true);
    expect(nodeFetchSpy).toHaveBeenLastCalledWith(
      responseUrl,
      expect.anything(),
    ); // Deletes ephemeral message
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(2, {
      channel: channelId,
      text: expect.stringContaining(
        `\`${projectFixture.path_with_namespace}\` added`,
      ),
      user: userId,
    });
    nodeFetchSpy.mockRestore();
  });

  it('should display threshold warning message when project is in too many channels', async () => {
    // Given
    const channelId = 'channelId';
    const projectId = projectFixture.id;
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `project add ${projectId}`,
      user_id: userId,
    };

    mockGitlabCall(`/projects/${projectId}`, projectFixture);

    // The project is already added to 3 channels
    await addProjectToChannel({
      channelId: `${channelId}1`,
      projectId: projectFixture.id,
    });
    await addProjectToChannel({
      channelId: `${channelId}2`,
      projectId: projectFixture.id,
    });
    await addProjectToChannel({
      channelId: `${channelId}3`,
      projectId: projectFixture.id,
    });

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(await hasModelEntry('Project', { channelId, projectId })).toEqual(
      true,
    );

    // Verify success message was sent
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(
        `\`${projectFixture.path_with_namespace}\` added`,
      ),
      user: userId,
    });

    // Verify threshold warning message was sent
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(2, {
      channel: channelId,
      text: expect.stringContaining(
        `D'oh! I've added \`${projectFixture.path_with_namespace}\` to this channel, but my brain is starting to hurt.`,
      ),
      user: userId,
    });

    // Verify the warning message contains the correct information
    const warningMessage = (slackBotWebClient.chat.postEphemeral as jest.Mock)
      .mock.calls[1][0].text;
    expect(warningMessage).toContain(`This project is now in 4 channels`);
    expect(warningMessage).toContain(`I've disabled automatic merge requests`);
  });
});
