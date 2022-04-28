import { ChatPostMessageArguments } from '@slack/web-api';
import { fetchUserById } from '@/core/services/gitlab';
import { fetchSlackUserFromGitlabUser } from '@/core/services/slack';

export async function buildNoteMessage(
  channelId: string,
  reviewMessageTs: string,
  noteAttributes: any
): Promise<ChatPostMessageArguments> {
  const message = {
    text: `:speech_balloon: ${noteAttributes.note.replace(/\\_/g, '_')}`,
    channel: channelId,
    thread_ts: reviewMessageTs,
    link_names: true,
    attachments: [
      {
        title: 'View it on Gitlab',
        title_link: noteAttributes.url,
        color: '#d4d4d4',
        fields: [
          {
            title: '',
            value: noteAttributes.original_position?.new_path ?? 'Global',
            short: false,
          },
        ],
      },
    ],
  } as ChatPostMessageArguments;

  const author = await fetchUserById(noteAttributes.author_id).then((user) =>
    user ? fetchSlackUserFromGitlabUser(user) : undefined
  );

  if (author !== undefined) {
    message.username = author.real_name;
    message.icon_url = author.profile.image_72;
  }

  return message;
}
