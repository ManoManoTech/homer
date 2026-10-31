import type { UserIdentityResolver } from '@/core/typings/UserIdentity';

let nextAnswer: unknown;
let nextGitUsernameAnswer: unknown;

/** Plugins are untyped JavaScript, so tests need answers outside the contract. */
export function answerWith(answer: unknown): void {
  nextAnswer = answer;
}

export function answerGitUsernameWith(answer: unknown): void {
  nextGitUsernameAnswer = answer;
}

const configurableDirectory: UserIdentityResolver = {
  async resolve() {
    return nextAnswer as never;
  },

  async findGitUsername() {
    return nextGitUsernameAnswer as never;
  },
};

export default configurableDirectory;
