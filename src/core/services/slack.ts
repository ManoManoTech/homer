import { WebClient } from '@slack/web-api';
import fetch from 'node-fetch';
import { GitlabUser } from '@/core/typings/GitlabUser';
import { SlackUser } from '@/core/typings/SlackUser';
import { getEnvVariable } from '@/core/utils/getEnvVariable';
import { logger } from './logger';

const SLACK_AUTH_TOKEN = getEnvVariable('SLACK_AUTH_TOKEN');
const SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN = getEnvVariable(
  'SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN'
);

// This client should be used only to post on behalf on user.
export const slackWebClient = new WebClient(SLACK_AUTH_TOKEN);

// This client should be used for everything else.
export const slackBotWebClient = new WebClient(
  SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN
);

export async function deleteEphemeralMessage(
  response_url: string
): Promise<void> {
  await fetch(response_url, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({
      delete_original: true,
    }),
  });
}

export async function getPermalink(
  channelId: string,
  messageTs: string
): Promise<string> {
  const { permalink } = await slackBotWebClient.chat.getPermalink({
    channel: channelId,
    message_ts: messageTs,
  });

  if (permalink === undefined) {
    throw new Error(
      `Failed to to get permalink with channel ${channelId} and message ${messageTs}`
    );
  }
  return permalink;
}

export async function fetchSlackUserFromEmail(
  email: string
): Promise<SlackUser | undefined> {
  try {
    const response = await slackBotWebClient.users.lookupByEmail({ email });
    return response.user as SlackUser;
  } catch (error) {
    logger.error(`Failed to to fetch slack user with email ${email}`);
  }
}

export async function fetchSlackUserFromEmails(
  emails: string[]
): Promise<SlackUser | undefined> {
  let user: SlackUser | undefined;

  for (const email of emails) {
    try {
      const response = await slackBotWebClient.users.lookupByEmail({ email });
      user = response.user as SlackUser;
      break;
    } catch {
      // Ignore
    }
  }

  if (user === undefined) {
    logger.error(
      `Failed to to fetch slack user with emails ${emails.join(', ')}`
    );
  }
  return user;
}

export async function fetchSlackUserFromGitlabUser({
  username,
}: GitlabUser): Promise<SlackUser | undefined> {
  return fetchSlackUserFromGitlabUsername(username);
}

export async function fetchSlackUserFromGitlabUsername(
  username: string
): Promise<SlackUser | undefined> {
  return fetchSlackUserFromEmails([
    `${username}@manomano.com`,
    `${username}@prt.manomano.com`,
  ]);
}

export async function fetchSlackUserFromId(
  userId: string
): Promise<SlackUser | undefined> {
  const response = await slackBotWebClient.users.info({ user: userId });
  return response?.user as SlackUser | undefined;
}

export async function fetchSlackUsersFromGitlabUsers(
  gitlabUsers: GitlabUser[]
): Promise<SlackUser[]> {
  const slackUsers = await Promise.all(
    gitlabUsers.map(fetchSlackUserFromGitlabUser)
  );
  return slackUsers.filter(Boolean) as SlackUser[];
}
