import type { GitlabUser } from '@/core/typings/GitlabUser';

export interface GitlabMergeRequestApprovalInfo {
  approvers: GitlabUser[];
  approvals_required: number;
  approvals_left: number;
}
