import { WebClient } from '@slack/web-api';
import { CONFIG } from '@/config';
import type { GitlabUser } from '@/core/typings/GitlabUser';
import type { SlackUser } from '@/core/typings/SlackUser';
import type { UserIdentity } from '@/core/typings/UserIdentity';
import { logger } from './logger';
import { findChatUser } from './userIdentity';

const SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN = CONFIG.slack.accessToken;

// This client should be used for everything else.
export const slackBotWebClient = new WebClient(
  SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN,
);

export async function deleteEphemeralMessage(
  response_url: string,
): Promise<void> {
  await fetch(response_url, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify({
      delete_original: true,
    }),
  });
}

/**
 * True when `err` is a `@slack/web-api` platform error whose Slack-side error
 * code matches `code` (e.g. 'is_archived', 'channel_not_found'). The shape
 * comes from `WebAPIPlatformError.data.error`.
 */
export function isSlackErrorCode(err: unknown, code: string): boolean {
  return (err as { data?: { error?: string } } | null)?.data?.error === code;
}

// See https://api.slack.com/reference/surfaces/formatting#escaping
export function escapeText(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export async function getPermalink(
  channelId: string,
  messageTs: string,
): Promise<string> {
  const { permalink } = await slackBotWebClient.chat.getPermalink({
    channel: channelId,
    message_ts: messageTs,
  });

  if (permalink === undefined) {
    throw new Error(
      `Failed to to get permalink with channel ${channelId} and message ${messageTs}`,
    );
  }
  return permalink;
}

const USERS_NOT_FOUND_SLACK_ERROR = 'users_not_found';

/**
 * Tries each email against `users.lookupByEmail` and returns the first match.
 *
 * Logging policy when no user is found:
 *  - All lookups returned `users_not_found` → `logger.info` (expected
 *    operational state: GitLab user left the company / is external / has no
 *    corporate Slack account).
 *  - At least one lookup threw a transient error (rate-limited, 5xx, …) →
 *    `logger.warn` with the underlying error, since this may indicate Slack
 *    health rather than user absence.
 */
export async function fetchSlackUserFromEmails(
  emails: string[],
): Promise<SlackUser | undefined> {
  let transientError: unknown;

  for (const email of emails) {
    try {
      const response = await slackBotWebClient.users.lookupByEmail({ email });
      return response.user as SlackUser;
    } catch (error) {
      if (!isSlackErrorCode(error, USERS_NOT_FOUND_SLACK_ERROR)) {
        transientError = error;
      }
    }
  }

  if (emails.length === 0) {
    return undefined;
  }

  if (transientError !== undefined) {
    logger.warn({ err: transientError, emails }, 'slack user lookup failed');
  } else {
    logger.info(
      { emails, slackError: USERS_NOT_FOUND_SLACK_ERROR },
      'no slack user found for emails',
    );
  }
  return undefined;
}

export async function fetchSlackUserFromGitlabUser({
  username,
}: GitlabUser): Promise<SlackUser | undefined> {
  return fetchSlackUserFromGitlabUsername(username);
}

export async function fetchSlackUserFromGitlabUsername(
  username: string,
): Promise<SlackUser | undefined> {
  return findChatUser(
    { provider: 'gitlab', username },
    fetchSlackUserFromIdentity,
  );
}

async function fetchSlackUserFromIdentity({
  chatUserId,
  emails = [],
}: UserIdentity): Promise<SlackUser | undefined> {
  if (chatUserId === undefined) {
    return fetchSlackUserFromEmails(emails);
  }
  try {
    return await fetchSlackUserFromId(chatUserId);
  } catch (error) {
    // An explicit id that Slack doesn't know means the resolver's data is
    // stale, which someone should fix, hence warn rather than info.
    logger.warn({ err: error, chatUserId }, 'slack user lookup by id failed');
    return undefined;
  }
}

export async function fetchSlackUserFromId(
  userId: string,
): Promise<SlackUser | undefined> {
  const response = await slackBotWebClient.users.info({ user: userId });
  return response?.user as SlackUser | undefined;
}

export async function fetchSlackUsersFromGitlabUsers(
  gitlabUsers: GitlabUser[],
): Promise<SlackUser[]> {
  const slackUsers = await Promise.all(
    gitlabUsers.map(fetchSlackUserFromGitlabUser),
  );
  return slackUsers.filter(Boolean) as SlackUser[];
}
