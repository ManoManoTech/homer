import { CONFIG } from '@/config';
import type { GithubRepository } from '@/core/typings/GithubModels';

export const githubRepositoryFixture: GithubRepository = {
  id: 987654,
  full_name: 'homer-org/homer-repo',
  html_url: `${CONFIG.github.url}/homer-org/homer-repo`,
  default_branch: 'main',
};
