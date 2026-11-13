import type { GitUser } from './GitUser';

/**
 * Author of a commit. Name and email come from the commit itself, so they
 * identify a person rather than a provider account: GitLab push payloads carry
 * nothing else. `user` is set only when the provider links the commit to an
 * account, which GitHub push payloads do.
 */
export interface GitCommitAuthor {
  name: string;
  email?: string;
  user?: GitUser;
}

export interface GitCommit {
  id: string;
  /** First line of the commit message. GitHub sends no separate title field. */
  title: string;
  message: string;
  webUrl: string;
  author: GitCommitAuthor;
}
