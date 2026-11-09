/**
 * A user of the git provider, as Homer knows them from a webhook or an API
 * response. GitLab is the only provider Homer talks to today, but the type
 * already names the others so that the provider-neutral domain built on it can
 * describe them, and so that a resolver can tell providers apart.
 *
 * A resolver that only knows one provider should answer `undefined` for the
 * rest rather than assume, so that the next resolver gets its turn.
 */
export interface GitUser {
  provider: 'gitlab' | 'github';
  username: string;
}

/**
 * How to find a git user on the chat platform. When `chatUserId` is set it is
 * used on its own; otherwise each email is tried in order.
 */
export interface UserIdentity {
  chatUserId?: string;
  emails?: string[];
}

/** A chat platform user, as Homer knows them when it needs their git user. */
export interface ChatUserInfo {
  chatUserId: string;
  email?: string;
}

/**
 * Maps a git user to their identity on the chat platform. Companies can add
 * their own resolvers as plugins, see docs/PLUGIN_USER_IDENTITY.md.
 */
export interface UserIdentityResolver {
  /**
   * Returns `undefined` or `null` when this resolver doesn't know the user, in
   * which case the next resolver is asked. Throwing, not answering within
   * 2 seconds, or returning anything that isn't a `UserIdentity` stops the
   * search and the user is left out.
   */
  resolve(user: GitUser): Promise<UserIdentity | null | undefined>;

  /**
   * Optional reverse lookup, used to personalize `/homer review list`: returns
   * the git username of a chat user, or `undefined` or `null` when this
   * resolver doesn't know them, in which case the next resolver is asked. A
   * resolver without this method stops the search, so that a later resolver's
   * guess never stands in for a resolver that can't answer.
   */
  findGitUsername?(chatUser: ChatUserInfo): Promise<string | null | undefined>;
}
