import {
  GitlabMergeRequestMergeStatus,
  GitlabMergeRequestState,
} from './GitlabMergeRequest';
import { GitlabUser } from './GitlabUser';

export type GitlabApprovalsResponse = {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: GitlabMergeRequestState;
  created_at: string;
  updated_at: string;
  merge_status: GitlabMergeRequestMergeStatus;
  approvals_required: number;
  approvals_left: number;
  approved_by: {
    user: GitlabUser;
  }[];
};
