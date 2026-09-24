import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

const emailsByUsername: Record<string, string> = {
  root: 'root.company@corp.test',
};

const companyDirectory: UserIdentityResolver = {
  async resolve({ username }) {
    const email = emailsByUsername[username];
    return email === undefined ? undefined : { emails: [email] };
  },
};

export default companyDirectory;
