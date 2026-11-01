import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

const emailsByUsername: Record<string, string> = {
  jdoe: 'jane.doe@corp.test',
  root: 'root.company@corp.test',
};

const companyDirectory: UserIdentityResolver = {
  async resolve({ username }) {
    const email = emailsByUsername[username];
    return email === undefined ? undefined : { emails: [email] };
  },

  async findGitUsername({ email }) {
    return Object.keys(emailsByUsername).find(
      (username) => emailsByUsername[username] === email,
    );
  },
};

export default companyDirectory;
