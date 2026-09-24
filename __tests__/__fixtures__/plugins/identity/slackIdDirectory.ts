import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

const slackIdDirectory: UserIdentityResolver = {
  async resolve({ username }) {
    return username === 'root' ? { chatUserId: 'U_ROOT' } : undefined;
  },
};

export default slackIdDirectory;
