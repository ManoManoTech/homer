import type {
  ContextBlock,
  MrkdwnElement,
  SectionBlock,
  StaticSelect,
} from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mockUrl } from '@root/__mocks__/fetch-mock';
import { mergeRequestApprovalsFixture } from '../__fixtures__/mergeRequestApprovalsFixture';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { mergeRequestReviewersFixture } from '../__fixtures__/mergeRequestReviewersFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import { reviewMessagePostFixture } from '../__fixtures__/reviewMessage';
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
      },
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
      [mergeRequestFixture],
    );
    mockBuildReviewMessageCalls();

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture,
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: mergeRequestDetailsFixture.iid,
        ts: 'ts',
      }),
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
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture,
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: mergeRequestDetailsFixture.iid,
        ts: 'ts',
      }),
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
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture,
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: mergeRequestDetailsFixture.iid,
        ts: 'ts',
      }),
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
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);
    const json = (await response.body) as any;

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
      [],
    );

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining(`No merge request matches \`${search}\``),
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
      [mergeRequestFixture, mergeRequestFixture],
    );

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

    expect(block?.text?.text).toContain(
      `Multiple merge requests match \`${search}\``,
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
    mockUrl(responseUrl, '');
    mockBuildReviewMessageCalls();

    // When
    response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      responseUrl,
      expect.anything(),
    ); // Deletes ephemeral message
    expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      reviewMessagePostFixture,
    );
    expect(
      await hasModelEntry('Review', {
        channelId,
        mergeRequestIid: iid,
        ts: 'ts',
      }),
    ).toEqual(true);
  });

  it('should display correct approval count, pipeline status, and mergeable field', async () => {
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

    // Create modified fixtures with different values
    const modifiedMergeRequestDetails = {
      ...mergeRequestDetailsFixture,
      merge_status: 'cannot_be_merged',
      head_pipeline: {
        id: 12345,
        status: 'failed',
        web_url:
          'https://gitlab.example.com/my-group/my-project/pipeline/12345',
      },
    };

    const modifiedMergeRequestApprovals = {
      ...mergeRequestApprovalsFixture,
      approvals_required: 3,
      approvals_left: 1,
      approved_by: [
        {
          user: {
            name: 'Administrator',
            username: 'root',
            id: 1,
            state: 'active',
            avatar_url:
              'http://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=80&d=identicon',
            web_url: 'http://localhost:3000/root',
          },
        },
      ],
    };

    // Mock GitLab API calls with modified fixtures
    mockGitlabCall(
      `/projects/${project_id}/merge_requests?state=opened&search=${search}`,
      [mergeRequestFixture],
    );

    // Mock the specific API calls with our modified fixtures
    mockGitlabCall(
      `/projects/${project_id}/merge_requests/${mergeRequestFixture.iid}`,
      modifiedMergeRequestDetails,
    );

    mockGitlabCall(
      `/projects/${project_id}/merge_requests/${mergeRequestFixture.iid}/approvals`,
      modifiedMergeRequestApprovals,
    );

    // Mock other necessary API calls
    mockGitlabCall(
      `/projects/${project_id}/merge_requests/${mergeRequestFixture.iid}/reviewers`,
      mergeRequestReviewersFixture,
    );

    mockGitlabCall(`/projects/${project_id}`, projectFixture);

    // When
    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);

    // Verify that the message was posted
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);

    // Get the actual message that was posted
    const postedMessage = (slackBotWebClient.chat.postMessage as jest.Mock).mock
      .calls[0][0];

    // Verify the pipeline status shows as failed
    const contextBlock = postedMessage.blocks[1] as ContextBlock;
    const pipelineElement = contextBlock.elements.find(
      (el) =>
        el.type === 'mrkdwn' && (el as MrkdwnElement).text.includes('Pipeline'),
    ) as MrkdwnElement;
    expect(pipelineElement.text).toContain('❌ failed');

    // Verify the mergeable status shows as No
    const mergeableElement = contextBlock.elements.find(
      (el) =>
        el.type === 'mrkdwn' &&
        (el as MrkdwnElement).text.includes('Mergeable'),
    ) as MrkdwnElement;
    expect(mergeableElement.text).toContain('⚠️ No');

    // Verify the approval count shows correctly
    const peopleSection = postedMessage.blocks[2] as SectionBlock;
    expect(peopleSection.fields).toBeDefined();
    const approvalField = peopleSection.fields?.find(
      (field) => field.type === 'mrkdwn' && field.text.includes('Approvals'),
    ) as MrkdwnElement;
    expect(approvalField.text).toContain('2/3 required ⏳');
  });
});
