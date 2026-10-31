import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

const hangingDirectory: UserIdentityResolver = {
  resolve() {
    return new Promise(() => {});
  },

  findGitUsername() {
    return new Promise(() => {});
  },
};

export default hangingDirectory;
