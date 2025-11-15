import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { addReviewToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

describe('review > rebaseSourceBranch', () => {
  it('should allow user to rebase a merge request source branch', async () => {
    // Given
    const channelId = 'channelId';
    const mergeRequestIid = 1;
    const projectId = mergeRequestFixture.project_id;
    const ts = 'ts';
    const userId = 'userId';
    const body = {
      payload: JSON.stringify({
        actions: [
          {
            action_id: 'review-message-actions',
            selected_option: {
              value: `review-rebase-source-branch~~${projectId}~~${mergeRequestFixture.iid}`,
            },
          },
        ],
        channel: { id: channelId },
        message: { ts },
        type: 'block_actions',
        user: { id: userId },
      }),
    };

    await addReviewToChannel({
      channelId,
      mergeRequestIid,
      projectId: typeof projectId === 'number' ? projectId : null,
      projectIdString: typeof projectId === 'string' ? projectId : null,
      providerType: 'gitlab',
      ts,
    });

    mockGitlabCall(
      `/projects/${mergeRequestFixture.project_id}/merge_requests/${mergeRequestFixture.iid}/rebase`,
      { rebase_in_progress: true },
    );

    // When
    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: channelId,
      text: expect.stringContaining('Rebase in progress'),
      user: userId,
    });
  });
});
