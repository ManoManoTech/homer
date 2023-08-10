import type { Request } from 'express';
import { slackBotWebClient } from '@/core/services/slack';
import type { SlackUser } from '@/core/typings/SlackUser';
import { buildAppHomeView } from './buildAppHomeView';

export async function appHomeOpenedHandler(req: Request): Promise<void> {
  const { user } = req.body.event;

  const slackUser = (await slackBotWebClient.users.info({ user }))
    .user as SlackUser;

  await slackBotWebClient.views.publish({
    user_id: user,
    view: await buildAppHomeView(slackUser),
  });
}
