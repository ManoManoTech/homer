import type { GitUser } from '@/core/typings/UserIdentity';

/**
 * Git providers Homer supports. Taken from the user identity plugin contract so
 * that adding a provider widens both at once.
 */
export type GitProviderName = GitUser['provider'];

/**
 * Identifies a repository. `id` is the provider's own stable identifier, as
 * text: GitLab project ids and GitHub repository ids are numeric, so the
 * provider adapter converts them, and nothing above it has to care.
 */
export interface RepoRef {
  provider: GitProviderName;
  id: string;
}

/** A repository, as the Slack message needs it. */
export interface Repo {
  ref: RepoRef;
  /** Repository name without its namespace. */
  name: string;
  /** Namespaced name, `group/project` on GitLab and `owner/name` on GitHub. */
  path: string;
  webUrl: string;
}
