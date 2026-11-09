import type { UnifiedUser } from '@/core/typings/UnifiedModels';
import githubUsers from '@root/config/homer/githubUsers.json';
import { fetchUserByLogin } from './github';

/** GitHub login → email, from `config/homer/githubUsers.json`. */
export type GithubUsersMapping = Record<string, string>;

/**
 * What Homer knows about who a GitHub user is, as emails. Chat platforms use
 * it to find the matching chat user.
 */
export class GithubUserDirectory {
  private readonly usersMapping: Map<string, string>;
  private readonly publicEmails = new Map<string, string | null>();

  constructor(usersMapping: GithubUsersMapping = {}) {
    this.usersMapping = new Map(
      Object.entries(usersMapping).map(([login, email]) => [
        login.toLowerCase(),
        email,
      ]),
    );
  }

  /** Email configured for a login in `githubUsers.json`. */
  findMappedEmail(login: string): string | undefined {
    return this.usersMapping.get(login.toLowerCase());
  }

  /** Reverse of `findMappedEmail`. */
  findMappedLogin(email: string): string | undefined {
    return [...this.usersMapping].find(
      ([, mappedEmail]) => mappedEmail.toLowerCase() === email.toLowerCase(),
    )?.[0];
  }

  /** Public email of the profile, which GitHub verifies. */
  async findPublicEmail(user: UnifiedUser): Promise<string | undefined> {
    if (user.email !== undefined) {
      return user.email;
    }
    const { username: login } = user;

    if (!this.publicEmails.has(login)) {
      try {
        this.publicEmails.set(
          login,
          (await fetchUserByLogin(login)).email ?? null,
        );
      } catch {
        this.publicEmails.set(login, null);
      }
    }
    return this.publicEmails.get(login) ?? undefined;
  }

  /** For tests that mock GitHub differently. */
  clearCaches(): void {
    this.publicEmails.clear();
  }
}

export const githubUserDirectory = new GithubUserDirectory(
  githubUsers as GithubUsersMapping,
);
