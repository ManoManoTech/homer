import { HTTP_STATUS_OK } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import { fetch } from '../utils/fetch';
import { getSlackHeaders } from '../utils/getSlackHeaders';

describe('home > appHome', () => {
  it('should publish user-specific app home', async () => {
    // Given
    const body = {
      challenge: 'challenge',
      event: {
        type: 'app_home_opened',
        user: 'userId',
      },
      type: 'event_callback',
    };
    (slackBotWebClient.users.info as jest.Mock).mockResolvedValueOnce({
      user: { real_name: 'real_name' },
    });

    // When
    const response = await fetch('/api/v1/homer/event', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(await response.text()).toEqual(body.challenge);
    expect(slackBotWebClient.views.publish).toHaveBeenNthCalledWith(1, {
      user_id: 'userId',
      view: {
        blocks: [
          {
            text: { text: expect.any(String), type: 'mrkdwn' },
            type: 'section',
          },
        ],
        type: 'home',
      },
    });
  });
});
