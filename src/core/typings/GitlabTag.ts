import type { GitlabCommit } from '@/core/typings/GitlabCommit';

export interface GitlabTag {
  commit: Omit<GitlabCommit, 'web_url'>;
  message: null;
  name: string;
  protected: true;
  release: {
    tag_name: string;
    description: string;
  };
  target: string;
}
