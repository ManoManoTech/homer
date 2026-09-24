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

/**
 * Asks each resolver in order who the git user is, and returns the first chat
 * user that `findOnChatPlatform` finds for one of the answers.
 */
export async function findChatUser<ChatUser>(
  user: GitUser,
  findOnChatPlatform: (identity: UserIdentity) => Promise<ChatUser | undefined>,
): Promise<ChatUser | undefined> {
  for (const { name, resolver } of resolvers) {
    let identity: UserIdentity | undefined;

    try {
      identity = await resolver.resolve(user);
    } catch (error) {
      // A failing resolver (e.g. its directory service is down) must not block
      // the notification: the next resolvers may still find the user.
      logger.error(
        { err: error, resolver: name, user },
        'user identity resolver failed',
      );
      continue;
    }
    if (identity === undefined) {
      continue;
    }
    const chatUser = await findOnChatPlatform(identity);
    if (chatUser !== undefined) {
      return chatUser;
    }
  }
  return undefined;
}
