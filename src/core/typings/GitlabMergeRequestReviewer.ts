import type { GitlabUser } from './GitlabUser';

/** Item of `/projects/:id/merge_requests/:iid/reviewers` */
export interface GitlabMergeRequestReviewer {
  /** ex: 2024-01-01T00:00:00.000Z */
  created_at: string;
  state:
    | 'unreviewed'
    | 'review_started'
    | 'reviewed'
    | 'requested_changes'
    | 'approved'
    | 'unapproved';
  user: GitlabUser;
}
