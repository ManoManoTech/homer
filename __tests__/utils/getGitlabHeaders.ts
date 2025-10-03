import { CONFIG } from '@/config';

export function getGitlabHeaders(): Record<string, string> {
  return {
    'X-Gitlab-Event': 'Push Hook',
    'X-Gitlab-Token': CONFIG.gitlab.secret,
  };
}
