import type { GitUser as GitUserIdentity } from '@/core/typings/UserIdentity';

/**
 * A user of the git provider. Extends the user identity plugin's view of a git
 * user, so one domain user can be handed straight to the resolver chain, with
 * the extra fields the Slack message needs: an email when the provider gives a
 * real one (more reliable than a computed one), and a display name.
 */
export interface GitUser extends GitUserIdentity {
  email?: string;
  displayName?: string;
}
