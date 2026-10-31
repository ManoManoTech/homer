import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

const forwardOnlyDirectory: UserIdentityResolver = {
  async resolve() {
    return undefined;
  },
};

export default forwardOnlyDirectory;
