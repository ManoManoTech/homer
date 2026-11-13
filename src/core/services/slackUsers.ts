import type { ProviderType } from '@/core/typings/Provider';
import type { SlackUser } from '@/core/typings/SlackUser';
import type { UnifiedUser } from '@/core/typings/UnifiedModels';
import { type GithubUserDirectory, githubUserDirectory } from './githubUsers';
import {
  fetchGitlabUsernameFromSlackUserId,
  fetchSlackUserFromEmails,
  fetchSlackUserFromGitlabUsername,
  fetchSlackUserFromGitUser,
  fetchSlackUserFromId,
} from './slack';

/**
 * Matches git users with Slack users. Kept out of the repository providers so
 * that they don't depend on a chat platform.
 */
export interface SlackUserLookup {
  findSlackUser(user: UnifiedUser): Promise<SlackUser | undefined>;
  /** Reverse of `findSlackUser`, used to personalize the review list. */
  findGitUsername(slackUserId: string): Promise<string | undefined>;
}

const gitlabSlackUserLookup: SlackUserLookup = {
  findSlackUser: (user) => fetchSlackUserFromGitlabUsername(user.username),
  findGitUsername: fetchGitlabUsernameFromSlackUserId,
};

/**
 * Tries, in order: `config/homer/githubUsers.json`, the user identity
 * resolvers (`USER_IDENTITY_RESOLVERS`), then the public email of the GitHub
 * profile. Only `githubUsers.json` knows GitHub logins from Slack users.
 */
export function createGithubSlackUserLookup(
  directory: GithubUserDirectory,
): SlackUserLookup {
  return {
    async findSlackUser(user) {
      const mappedEmail = directory.findMappedEmail(user.username);

      if (mappedEmail !== undefined) {
        return fetchSlackUserFromEmails([mappedEmail]);
      }

      const slackUser = await fetchSlackUserFromGitUser({
        provider: 'github',
        username: user.username,
      });
      if (slackUser !== undefined) {
        return slackUser;
      }

      const publicEmail = await directory.findPublicEmail(user);
      return publicEmail ? fetchSlackUserFromEmails([publicEmail]) : undefined;
    },

    async findGitUsername(slackUserId) {
      let email: string | undefined;

      try {
        email = (await fetchSlackUserFromId(slackUserId))?.profile?.email;
      } catch {
        return undefined;
      }
      return email === undefined ? undefined : directory.findMappedLogin(email);
    },
  };
}

const slackUserLookups: Record<ProviderType, SlackUserLookup> = {
  github: createGithubSlackUserLookup(githubUserDirectory),
  gitlab: gitlabSlackUserLookup,
};

export function findSlackUser(
  provider: ProviderType,
  user: UnifiedUser,
): Promise<SlackUser | undefined> {
  return slackUserLookups[provider].findSlackUser(user);
}

export function findGitUsername(
  provider: ProviderType,
  slackUserId: string,
): Promise<string | undefined> {
  return slackUserLookups[provider].findGitUsername(slackUserId);
}

export async function fetchSlackUsers(
  provider: ProviderType,
  users: UnifiedUser[],
): Promise<SlackUser[]> {
  const slackUsers = await Promise.all(
    users.map((user) => findSlackUser(provider, user)),
  );
  return slackUsers.filter((user): user is SlackUser => user !== undefined);
}
