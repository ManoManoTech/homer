import type { View } from '@slack/web-api';
import { HOMER_GIT_URL, SLACK_SUPPORT_CHANNEL_ID } from '@/constants';
import type { SlackUser } from '@/core/typings/SlackUser';

export async function buildAppHomeView(user: SlackUser): Promise<View> {
  const firstName = user.real_name.split(' ')[0];

  return {
    type: 'home',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\
Hello *${firstName}*, I'm *Homer*, the Slack Gitlab master!

If you want to take a :beer: with me, don't hesitate to join <#${SLACK_SUPPORT_CHANNEL_ID}>.

If you want to better know me, here are some useful links:

:gitlab: <${HOMER_GIT_URL}|Github project>
:books: <${HOMER_GIT_URL}blob/main/README.md|Documentation>
:bug: <${HOMER_GIT_URL}issues|Issues>
`,
        },
      },
    ],
  };
}
