import type { ChatPostMessageArguments } from '@slack/web-api';
import { CONFIG } from '@/config';

export function buildHelpMessage(channelId: string): ChatPostMessageArguments {
  return {
    channel: channelId,
    text: `\
Here are the available commands:

- /homer changelog - Display changelogs, for any Gitlab project, between 2 release tags.
- /homer project add &lt;project_name|project_id&gt; - Add a Gitlab project to a channel.
- /homer project list - List the Gitlab projects added to a channel.
- /homer project remove - Remove a Gitlab project from a channel.
- /homer review &lt;search&gt; - Share a merge request on a channel. Searches in title and description by default. Accepts merge request URLs and merge request IDs prefixed with "!".
- /homer review list - List ongoing reviews shared in a channel.
- /homer release - Create a release for configured Gitlab project in a channel.

Don't hesitate to join me on #${CONFIG.slack.supportChannel.name} to take a beer!`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\
Here are the available commands:

•   \`/homer changelog\` Display changelogs, for any Gitlab project, between 2 release tags.
•   \`/homer project add &lt;project_name|project_id&gt;\` Add a Gitlab project to a channel.
•   \`/homer project list\` List the Gitlab projects added to a channel.
•   \`/homer project remove\` Remove a Gitlab project from a channel.
•   \`/homer review &lt;search&gt;\` Share a merge request on a channel. Searches in title and description by default. Accepts merge request URLs and merge request IDs prefixed with "!".
•   \`/homer review list\` List ongoing reviews shared in a channel.
•   \`/homer release\` Create a release for configured Gitlab project in a channel.

Don't hesitate to join me on <#${CONFIG.slack.supportChannel.id}> to take a :beer:!`,
        },
      },
    ],
  };
}
