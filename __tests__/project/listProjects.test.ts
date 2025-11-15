import slackifyMarkdown from 'slackify-markdown';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { projectFixture } from '../__fixtures__/projectFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('project > listProjects', () => {
  it('should allow user to list projects', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'project list',
      user_id: userId,
    };

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
      projectIdString: null,
      providerType: 'gitlab',
    });
    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id + 1,
      projectIdString: null,
      providerType: 'gitlab',
    });
    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id + 2,
      projectIdString: null,
      providerType: 'gitlab',
    });

    mockGitlabCall(`/projects/${projectFixture.id}`, projectFixture);
    mockGitlabCall(`/projects/${projectFixture.id + 1}`, projectFixture);
    // This project will be removed from the list because it doesn't exist
    mockGitlabCall(`/projects/${projectFixture.id + 2}`, {});

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
      blocks: [
        {
          text: {
            text: slackifyMarkdown(`**Channel projects:**
- [diaspora/diaspora-project-site](https://my-git.domain.com/diaspora/diaspora-project-site)
- [diaspora/diaspora-project-site](https://my-git.domain.com/diaspora/diaspora-project-site)`),
            type: 'mrkdwn',
          },
          type: 'section',
        },
      ],
      channel: 'channelId',
      text: 'Channel projects: diaspora/diaspora-project-site, diaspora/diaspora-project-site.',
      user: 'userId',
    });
  });

  it('should notify user when there is no project', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: 'project list',
      user_id: userId,
    };

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledWith({
      blocks: [
        {
          text: {
            text: 'No project has been added to this channel yet :homer-metal:',
            type: 'mrkdwn',
          },
          type: 'section',
        },
      ],
      channel: 'channelId',
      text: 'No project has been added to this channel yet.',
      user: 'userId',
    });
  });
});
