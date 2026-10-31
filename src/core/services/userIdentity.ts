import { CONFIG } from '@/config';
import type {
  ChatUserInfo,
  GitUser,
  UserIdentity,
  UserIdentityResolver,
} from '@/core/typings/UserIdentity';
import { logger } from './logger';

const PLUGIN_DIRECTORY = '@root/plugins/identity';
// The merge request webhook looks users up before answering GitLab, which
// gives up after 10 s on GitLab.com and disables webhooks that keep failing;
// the GitLab API calls made for the same event need the rest of that budget.
const RESOLVER_TIMEOUT_MS = 2000;

/** Assumes git usernames match the local part of the company email. */
const emailDomainConvention: UserIdentityResolver = {
  async resolve({ username }) {
    return {
      emails: CONFIG.slack.emailDomains
        .split(',')
        .map((emailDomain) => `${username}@${emailDomain}`),
    };
  },

  async findGitUsername({ email }) {
    const [username, domain] = email?.split('@') ?? [];

    return username && CONFIG.slack.emailDomains.split(',').includes(domain)
      ? username
      : undefined;
  },
};

const BUILT_IN_RESOLVERS: Record<string, UserIdentityResolver> = {
  emailDomainConvention,
};

interface NamedResolver {
  name: string;
  resolver: UserIdentityResolver;
}

let resolvers: NamedResolver[] = [
  { name: 'emailDomainConvention', resolver: emailDomainConvention },
];
let resolverTimeoutMs = RESOLVER_TIMEOUT_MS;

/**
 * Replaces the resolver chain. Each name is either a built-in resolver or the
 * file name of a plugin in `pluginDirectory`.
 */
export async function loadUserIdentityResolvers(
  names: string[],
  pluginDirectory = PLUGIN_DIRECTORY,
  timeoutMs = RESOLVER_TIMEOUT_MS,
): Promise<void> {
  if (names.length === 0) {
    throw new Error('At least one user identity resolver must be configured.');
  }
  resolverTimeoutMs = timeoutMs;
  resolvers = await Promise.all(
    names.map(async (name) => ({
      name,
      resolver:
        BUILT_IN_RESOLVERS[name] ?? (await importPlugin(name, pluginDirectory)),
    })),
  );
}

async function importPlugin(
  name: string,
  pluginDirectory: string,
): Promise<UserIdentityResolver> {
  const path = `${pluginDirectory}/${name}`;
  let plugin: Partial<UserIdentityResolver> | undefined;

  try {
    ({ default: plugin } = await import(path));
  } catch (error) {
    throw new Error(
      `Cannot load user identity resolver "${name}" from ${path}. Reason: ${error}`,
    );
  }
  if (typeof plugin?.resolve !== 'function') {
    throw new Error(
      `Cannot load user identity resolver "${name}": its default export must have a resolve function.`,
    );
  }
  if (
    plugin.findGitUsername !== undefined &&
    typeof plugin.findGitUsername !== 'function'
  ) {
    throw new Error(
      `Cannot load user identity resolver "${name}": findGitUsername must be a function when it is provided.`,
    );
  }
  return plugin as UserIdentityResolver;
}

/** Outcome of looking an identity up on the chat platform. */
export type ChatUserLookup<ChatUser> =
  | { status: 'found'; chatUser: ChatUser }
  | { status: 'not_found' }
  | { status: 'failed' };

/**
 * Asks each resolver in order who the git user is, and returns the first chat
 * user that `findOnChatPlatform` finds for one of the answers.
 *
 * Only an explicit "unknown user" moves on to the next resolver. Any failure
 * (resolver error, invalid answer, chat lookup failure) stops the chain and
 * returns no user: later resolvers are often guesses, and falling back to one
 * while the resolver that knows better is unavailable could name the wrong
 * person, which is worse than naming nobody.
 */
export async function findChatUser<ChatUser>(
  user: GitUser,
  findOnChatPlatform: (
    identity: UserIdentity,
  ) => Promise<ChatUserLookup<ChatUser>>,
): Promise<ChatUser | undefined> {
  for (const { name, resolver } of resolvers) {
    // Plugins are untyped JavaScript, so their answer is checked before use.
    let identity: unknown;

    try {
      identity = await withTimeout(resolver.resolve(user), resolverTimeoutMs);
    } catch (error) {
      logger.error(
        { err: error, resolver: name, user },
        'user identity resolver failed',
      );
      return undefined;
    }
    if (identity === undefined || identity === null) {
      continue;
    }
    if (!isUserIdentity(identity)) {
      logger.error(
        { resolver: name, user, identity },
        'user identity resolver returned an invalid identity',
      );
      return undefined;
    }
    const lookup = await findOnChatPlatform(identity);
    if (lookup.status === 'found') {
      return lookup.chatUser;
    }
    if (lookup.status === 'failed') {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Reverse of `findChatUser`: asks each resolver in order which git user a chat
 * user is. Follows the same rules: only an explicit "unknown user" moves on to
 * the next resolver, any failure returns no username. A resolver without
 * `findGitUsername` also stops the search, since a later resolver could only
 * guess about a user the earlier one may know.
 */
export async function findGitUsernameOfChatUser(
  chatUser: ChatUserInfo,
): Promise<string | undefined> {
  for (const { name, resolver } of resolvers) {
    if (resolver.findGitUsername === undefined) {
      return undefined;
    }
    let username: unknown;

    try {
      username = await withTimeout(
        resolver.findGitUsername(chatUser),
        resolverTimeoutMs,
      );
    } catch (error) {
      logger.error(
        { err: error, resolver: name, chatUser },
        'user identity resolver failed',
      );
      return undefined;
    }
    if (username === undefined || username === null) {
      continue;
    }
    if (typeof username !== 'string' || username === '') {
      logger.error(
        { resolver: name, chatUser, username },
        'user identity resolver returned an invalid git username',
      );
      return undefined;
    }
    return username;
  }
  return undefined;
}

/**
 * Stops waiting for `promise` after `timeoutMs`. The plugin's own work can't be
 * cancelled and may still finish in the background; its result is ignored.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `user identity resolver did not answer within ${timeoutMs} ms`,
          ),
        ),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function isUserIdentity(value: unknown): value is UserIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { chatUserId, emails } = value as Record<string, unknown>;
  return (
    (chatUserId === undefined || typeof chatUserId === 'string') &&
    (emails === undefined ||
      (Array.isArray(emails) &&
        emails.every((email) => typeof email === 'string')))
  );
}
