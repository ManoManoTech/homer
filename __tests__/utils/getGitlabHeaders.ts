export function getGitlabHeaders(): Record<string, string> {
  return {
    'X-Gitlab-Event': 'Push Hook',
    'X-Gitlab-Token': process.env.GITLAB_SECRET as string,
  };
}
