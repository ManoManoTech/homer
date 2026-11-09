import type { ChatPostMessageArguments, KnownBlock } from '@slack/web-api';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { escapeText } from '@/core/services/slack';
import { findSlackUser } from '@/core/services/slackUsers';
import type { ProviderType } from '@/core/typings/Provider';
import { SLACK_CHARACTER_LIMIT, slackifyText } from '@/core/utils/slackifyText';

export interface Note {
  author_id: number;
  note: string;
  url: string;
}

export async function buildNoteMessage(
  providerType: ProviderType,
  channelId: string,
  reviewMessageTs: string,
  noteAttributes: Note[],
): Promise<ChatPostMessageArguments> {
  const provider = getProvider(providerType);
  const author = await provider
    .fetchUser(noteAttributes[0].author_id)
    .then((user) => (user ? findSlackUser(providerType, user) : undefined));
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
    text: slackifyText(
      noteAttributes
        .map(({ note }) => `:speech_balloon_blue: ${escapeText(note)}`)
        .join('\n\n'),
      '*⚠️ Notes truncated due to Slack limitations.*',
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
    SLACK_CHARACTER_LIMIT - linkToView.length,
  )}${linkToView}`;
}
