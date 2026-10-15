import { CONFIG } from '@/config';
import type {
  GitUser,
  UserIdentity,
  UserIdentityResolver,
} from '@/core/typings/UserIdentity';
import { logger } from './logger';

const PLUGIN_DIRECTORY = '@root/plugins/identity';

/** Assumes git usernames match the local part of the company email. */
const emailDomainConvention: UserIdentityResolver = {
  async resolve({ username }) {
    return {
      emails: CONFIG.slack.emailDomains
        .split(',')
        .map((emailDomain) => `${username}@${emailDomain}`),
    };
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

/**
 * Replaces the resolver chain. Each name is either a built-in resolver or the
 * file name of a plugin in `pluginDirectory`.
 */
export async function loadUserIdentityResolvers(
  names: string[],
  pluginDirectory = PLUGIN_DIRECTORY,
): Promise<void> {
  if (names.length === 0) {
    throw new Error('At least one user identity resolver must be configured.');
  }
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
      identity = await resolver.resolve(user);
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
