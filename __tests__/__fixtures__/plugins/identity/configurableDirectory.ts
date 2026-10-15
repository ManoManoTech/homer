import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

let nextAnswer: unknown;

/** Plugins are untyped JavaScript, so tests need answers outside the contract. */
export function answerWith(answer: unknown): void {
  nextAnswer = answer;
}

const configurableDirectory: UserIdentityResolver = {
  async resolve() {
    return nextAnswer as never;
  },
};

export default configurableDirectory;
