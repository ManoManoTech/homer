import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('review > refreshReview', () => {
  const channelId = 'channelId';
  const mergeRequestIid = mergeRequestFixture.iid;
  const projectId = mergeRequestFixture.project_id;
  const ts = 'ts';
  const userId = 'userId';

  const buildBody = () => ({
    payload: JSON.stringify({
      actions: [
        {
          action_id: 'review-message-actions',
          selected_option: {
            value: `review-refresh~~${projectId}~~${mergeRequestIid}`,
          },
        },
      ],
      channel: { id: channelId },
      message: { ts },
      type: 'block_actions',
      user: { id: userId },
    }),
  });

  const permalink =
    'https://manomano-team.slack.com/archives/CKXA1FASF/p1640343776000900';

  beforeEach(() => {
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
    (slackBotWebClient.chat.update as jest.Mock).mockResolvedValue({});
    (slackBotWebClient.chat.getPermalink as jest.Mock).mockResolvedValue({
      permalink,
    });
  });

  it('should refresh the review message and keep it in DB when MR is merged', async () => {
    mockBuildReviewMessageCalls();
    mockGitlabCall(`/projects/${projectId}/merge_requests/${mergeRequestIid}`, {
      ...mergeRequestDetailsFixture,
      state: 'merged',
    });

    await addReviewToChannel({ channelId, mergeRequestIid, projectId, ts });
    const body = buildBody();

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.update).toHaveBeenCalled();
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      user: userId,
      text: expect.stringContaining(permalink),
    });
    expect(
      await hasModelEntry('Review', { channelId, mergeRequestIid, ts }),
    ).toEqual(true);
  });

  it('should refresh the review message and keep it in DB when MR is still open', async () => {
    mockBuildReviewMessageCalls(); // mergeRequestDetailsFixture has state: 'opened'

    await addReviewToChannel({ channelId, mergeRequestIid, projectId, ts });
    const body = buildBody();

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.update).toHaveBeenCalled();
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      user: userId,
      text: expect.stringContaining(permalink),
    });
    expect(
      await hasModelEntry('Review', { channelId, mergeRequestIid, ts }),
    ).toEqual(true);
  });
});
