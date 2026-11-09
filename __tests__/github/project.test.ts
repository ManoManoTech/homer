import type { SectionBlock, StaticSelect } from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mockUrl } from '@root/__mocks__/fetch-mock';
import { githubRepositoryFixture } from '../__fixtures__/github/repositoryFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGithubCall } from '../utils/mockGithubCall';

const channelId = 'channelId';
const userId = 'userId';

async function sendCommand(text: string) {
  const body = { channel_id: channelId, text, user_id: userId };
  return request(app)
    .post('/api/v1/homer/command')
    .set(getSlackHeaders(body))
    .send(body);
}

describe('github > project', () => {
  it('should add a repository by name', async () => {
    // Given
    const { full_name, id } = githubRepositoryFixture;
    mockGithubCall(`/repos/${full_name}`, githubRepositoryFixture);

    // When
    const response = await sendCommand(`project add github ${full_name}`);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(
      await hasModelEntry('Project', {
        channelId,
        projectId: id,
        provider: 'github',
        repoSlug: full_name,
      }),
    ).toEqual(true);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(
        `\`${full_name}\` added to this channel :homer-happy:\n\nDon't forget to <${githubRepositoryFixture.html_url}/settings/hooks|set up a webhook> in your GitHub repository`,
      ),
      user: userId,
    });
  });

  it('should add a repository by URL', async () => {
    // Given
    const { full_name, html_url, id } = githubRepositoryFixture;
    mockGithubCall(`/repos/${full_name}`, githubRepositoryFixture);

    // When
    await sendCommand(`project add ${html_url}`);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Project', { projectId: id, provider: 'github' }),
    ).toEqual(true);
  });

  it('should add a repository by id', async () => {
    // Given
    const { id } = githubRepositoryFixture;
    mockGithubCall(`/repositories/${id}`, githubRepositoryFixture);

    // When
    await sendCommand(`project add github ${id}`);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Project', { projectId: id, provider: 'github' }),
    ).toEqual(true);
  });

  it('should tell when no repository matches a name', async () => {
    // Given
    mockGithubCall('/repos/homer-org/unknown', { message: 'Not Found' }, 404);

    // When
    await sendCommand('project add github homer-org/unknown');

    // Then
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: 'No project matches `homer-org/unknown` :homer-stressed:',
      user: userId,
    });
  });

  it('should let the user pick a repository among search results', async () => {
    // Given
    const other = {
      ...githubRepositoryFixture,
      id: githubRepositoryFixture.id + 1,
      full_name: 'homer-org/homer-other',
    };
    mockGithubCall('/search/repositories?q=homer&per_page=20', {
      items: [githubRepositoryFixture, other],
    });

    // When
    await sendCommand('project add github homer');

    // Then
    const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
      .calls[0][0].blocks[0] as SectionBlock;
    const { action_id, options } = block.accessory as StaticSelect;
    expect(options?.map(({ value }) => value)).toEqual([
      `project~~github:${other.id}~~${other.full_name}`,
      `project~~github:${githubRepositoryFixture.id}~~${githubRepositoryFixture.full_name}`,
    ]);

    // When
    const body = {
      payload: JSON.stringify({
        actions: [{ action_id, selected_option: options?.[1] }],
        container: { channel_id: channelId },
        response_url: 'https://slack/response',
        type: 'block_actions',
        user: { id: userId },
      }),
    };
    mockUrl('https://slack/response', {});
    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(
      await hasModelEntry('Project', {
        projectId: githubRepositoryFixture.id,
        provider: 'github',
      }),
    ).toEqual(true);
  });

  it('should list and remove GitHub repositories', async () => {
    // Given
    const { full_name, html_url, id } = githubRepositoryFixture;
    await addProjectToChannel({ channelId, projectId: id, provider: 'github' });
    mockGithubCall(`/repositories/${id}`, githubRepositoryFixture);

    // When
    await sendCommand('project list');

    // Then
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: `Channel projects: ${full_name}.`,
      }),
    );
    expect(
      (slackBotWebClient.chat.postEphemeral as jest.Mock).mock.calls[0][0]
        .blocks[0].text.text,
    ).toContain(html_url);

    // When
    await sendCommand('project remove');
    const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
      .calls[1][0].blocks[0] as SectionBlock;
    const { action_id, options } = block.accessory as StaticSelect;
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
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Project', { projectId: id, provider: 'github' }),
    ).toEqual(false);
  });
});
