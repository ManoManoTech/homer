import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

const slackIdDirectory: UserIdentityResolver = {
  async resolve({ username }) {
    return username === 'root' ? { chatUserId: 'U_ROOT' } : undefined;
  },

  async findGitUsername({ chatUserId }) {
    return chatUserId === 'U_JANE' ? 'jdoe' : undefined;
  },
};

export default slackIdDirectory;
