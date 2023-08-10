import type { SectionBlock, StaticSelect } from '@slack/web-api';
import * as nodeFetch from 'node-fetch';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import {
  reviewMessagePostFixture,
  reviewMessageSpartacuxPostFixture,
} from '../__fixtures__/reviewMessage';
import { fetch } from '../utils/fetch';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('review > addReview', () => {
  beforeEach(async () => {
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      ({ email }: { email: string }) => {
        const name = email.split('@')[0];
        return Promise.resolve({
          user: {
            name,
            profile: { image_72: 'image_72' },
            real_name: `${name}.real`,
          },
        });
      }
    );
  });

  it('should add review', async () => {
    // Given
    const { project_id } = mergeRequestDetailsFixture;
    const channelId = 'channelId';
    const search = 'chore(test)';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `review ${search}`,
      user_id: userId,
    };

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
    });
    mockGitlabCall(
      `/projects/${project_id}/merge_requests?state=opened&search=${search}`,
      [mergeRequestFixture]
    );
    mockBuildReviewMessageCalls();

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: mergeRequestDetailsFixture.iid,
        ts: 'ts',
      })
    ).toEqual(true);
  });

  it('should add review on Spartacux', async () => {
    // Given
    const { project_id } = mergeRequestDetailsFixture;
    const channelId = 'channelId';
    const search = 'chore(test)';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `review ${search}`,
      user_id: userId,
    };

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
    });
    mockGitlabCall(
      `/projects/${project_id}/merge_requests?state=opened&search=${search}`,
      [mergeRequestFixture]
    );
    mockBuildReviewMessageCalls();
    mockGitlabCall(`/projects/${project_id}`, {
      ...projectFixture,
      path: 'spartacux',
    });

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessageSpartacuxPostFixture
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: mergeRequestDetailsFixture.iid,
        ts: 'ts',
      })
    ).toEqual(true);
  });

  it('should add review from merge request id', async () => {
    // Given
    const { iid } = mergeRequestDetailsFixture;
    const channelId = 'channelId';
    const search = `!${iid}`;
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `review ${search}`,
      user_id: userId,
    };

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
    });
    mockBuildReviewMessageCalls();

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: mergeRequestDetailsFixture.iid,
        ts: 'ts',
      })
    ).toEqual(true);
  });

  it('should add review from merge request url', async () => {
    // Given
    const { web_url } = mergeRequestDetailsFixture;
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `review ${web_url}`,
      user_id: userId,
    };

    await addProjectToChannel({
      channelId,
      projectId: projectFixture.id,
    });
    mockBuildReviewMessageCalls();

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: mergeRequestDetailsFixture.iid,
        ts: 'ts',
      })
    ).toEqual(true);
  });

  it('should display help if no query', async () => {
    // Given
    const channelId = 'channelId';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: '',
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

  it('should notify user whether no merge request found', async () => {
    // Given
    const channelId = 'channelId';
    const projectId = 789;
    const search = 'chore(test)';
    const userId = 'userId';
    const body = {
      channel_id: channelId,
      text: `review ${search}`,
      user_id: userId,
    };

    await addProjectToChannel({ channelId, projectId });
    mockGitlabCall(
      `/projects/${projectId}/merge_requests?state=opened&search=${search}`,
      []
    );

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(`No merge request match \`${search}\``),
      user: userId,
    });
  });

  it('should allow user to choose whether multiple merge requests are found', async () => {
    // Given
    const { iid, project_id } = mergeRequestFixture;
    const channelId = 'channelId';
    const search = 'chore(test)';
    const userId = 'userId';
    let body: Record<string, unknown> = {
      channel_id: channelId,
      text: `review ${search}`,
      user_id: userId,
    };

    await addProjectToChannel({
      channelId,
      projectId: project_id,
    });
    mockGitlabCall(
      `/projects/${project_id}/merge_requests?state=opened&search=${search}`,
      [mergeRequestFixture, mergeRequestFixture]
    );

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
        blocks: expect.any(Array),
        channel: channelId,
        user: userId,
      })
    );

    const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
      .calls[0][0].blocks[0] as SectionBlock | undefined;

    expect(block?.text?.text).toContain(
      `Multiple merge requests match \`${search}\``
    );
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
    mockBuildReviewMessageCalls();

    // When
    response = await fetch('/api/v1/homer/interactive', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(nodeFetchSpy).toHaveBeenNthCalledWith(
      2,
      responseUrl,
      expect.anything()
    ); // Deletes ephemeral message
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: iid,
        ts: 'ts',
      })
    ).toEqual(true);
    nodeFetchSpy.mockRestore();
  });
});
