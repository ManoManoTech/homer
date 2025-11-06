import type { SlackUser } from '@/core/typings/SlackUser';

export const slackUserFixture: SlackUser = {
  id: 'slackUserId',
  team_id: 'T0123456',
  name: 'name',
  deleted: false,
  color: '9f69e7',
  real_name: 'real_name',
  tz: 'America/Los_Angeles',
  tz_label: 'Pacific Standard Time',
  tz_offset: -28800,
  profile: {
    avatar_hash: 'g1234567890',
    status_text: 'Working from home',
    status_emoji: ':house:',
    real_name: 'real_name',
    display_name: 'johndoe',
    real_name_normalized: 'John Doe',
    display_name_normalized: 'johndoe',
    email: 'john.doe@example.com',
    image_24:
      'https://secure.gravatar.com/avatar/123456789abcdef.jpg?s=24&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0000-24.png',
    image_32:
      'https://secure.gravatar.com/avatar/123456789abcdef.jpg?s=32&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0000-32.png',
    image_48:
      'https://secure.gravatar.com/avatar/123456789abcdef.jpg?s=48&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0000-48.png',
    image_72: 'image_72',
    image_192:
      'https://secure.gravatar.com/avatar/123456789abcdef.jpg?s=192&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0000-192.png',
    image_512:
      'https://secure.gravatar.com/avatar/123456789abcdef.jpg?s=512&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0000-512.png',
    team: 'T0123456',
  },
  is_admin: false,
  is_owner: false,
  is_primary_owner: false,
  is_restricted: false,
  is_ultra_restricted: false,
  is_bot: false,
  updated: 1609459200,
  is_app_user: false,
  has_2fa: true,
};
