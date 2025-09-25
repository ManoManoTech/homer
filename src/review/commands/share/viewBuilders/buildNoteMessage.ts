import type { ChatPostMessageArguments, KnownBlock } from '@slack/web-api';
import { fetchUserById } from '@/core/services/gitlab';
import {
  escapeText,
  fetchSlackUserFromGitlabUser,
} from '@/core/services/slack';
import { SLACK_CHARACTER_LIMIT, slackifyText } from '@/core/utils/slackifyText';

export async function buildNoteMessage(
  channelId: string,
  reviewMessageTs: string,
  noteAttributes: { author_id: number; note: string; url: string }[]
): Promise<ChatPostMessageArguments> {
  const author = await fetchUserById(noteAttributes[0].author_id).then((user) =>
    user ? fetchSlackUserFromGitlabUser(user) : undefined
  );
  return {
    blocks: [
      ...noteAttributes.map(({ note, url }) => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: slackifyNote(note, url),
        },
      })),
      ...(author !== undefined
        ? [
            {
              type: 'context',
              elements: [
                {
                  type: 'image' as const,
                  image_url: author.profile.image_24,
                  alt_text: author.real_name,
                },
                {
                  type: 'mrkdwn' as const,
                  text: `*${author.real_name}*`,
                },
              ],
            },
          ]
        : []),
    ] as KnownBlock[],
    icon_emoji: ':speech_balloon_blue:',
    text: slackifyNote(
      noteAttributes
        .map(({ note }) => `:speech_balloon_blue: ${note}`)
        .join('\n\n')
    ),
    channel: channelId,
    thread_ts: reviewMessageTs,
    link_names: true,
    unfurl_links: false,
  };
}

function slackifyNote(note: string, url?: string): string {
  const linkToView = url ? `<${url}|View>` : '';

  return `${slackifyText(
    `${escapeText(note).replace(/\\_/g, '_')}`,
    '*⚠️ Note truncated due to Slack limitations.*',
    SLACK_CHARACTER_LIMIT - linkToView.length
  )}${linkToView}`;
}
