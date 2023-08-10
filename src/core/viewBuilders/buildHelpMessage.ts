import type { ChatPostMessageArguments } from '@slack/web-api';
import { MOES_TAVERN_CHANNEL_ID } from '@/constants';

export function buildHelpMessage(channelId: string): ChatPostMessageArguments {
  return {
    channel: channelId,
    text: `\
Here are the available commands:

- /homer changelog - Generate changelogs for any Gitlab project using release tags.
- /homer project add &lt;project_name|project_id&gt; - Add a Gitlab project to a channel.
- /homer project list - List the Gitlab projects added to a channel.
- /homer project remove - Remove a Gitlab project from a channel.
- /homer release - Create a Gitlab release.
- /homer release cancel - Cancel a Gitlab release.
- /homer release end - End a Gitlab release.
- /homer review &lt;search&gt; - Share a merge request on a channel. Searches in title and description by default. Accepts merge request URLs and merge request IDs prefixed with "!".
- /homer review list - List ongoing reviews shared in a channel.

Don't hesitate to join me on #moes-tavern-homer to take a beer!`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\
Here are the available commands:

•   \`/homer changelog\` Generate changelogs for any Gitlab project using release tags.
•   \`/homer project add &lt;project_name|project_id&gt;\` Add a Gitlab project to a channel.
•   \`/homer project list\` List the Gitlab projects added to a channel.
•   \`/homer project remove\` Remove a Gitlab project from a channel.
•   \`/homer release\` Create a Gitlab release.
•   \`/homer release cancel\` Cancel a Gitlab release.
•   \`/homer release end\` End a Gitlab release.
•   \`/homer review &lt;search&gt;\` Share a merge request on a channel. Searches in title and description by default. Accepts merge request URLs and merge request IDs prefixed with "!".
•   \`/homer review list\` List ongoing reviews shared in a channel.

Don't hesitate to join me on <#${MOES_TAVERN_CHANNEL_ID}> to take a :beer:!`,
        },
      },
    ],
  };
}
