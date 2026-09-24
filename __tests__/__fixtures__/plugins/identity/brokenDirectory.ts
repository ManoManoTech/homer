import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

const brokenDirectory: UserIdentityResolver = {
  async resolve() {
    throw new Error('directory unavailable');
  },
};

export default brokenDirectory;
