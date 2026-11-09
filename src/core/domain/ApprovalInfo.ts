import type { GitUser } from './GitUser';

/**
 * Who approved a merge request, and how many approvals it needs.
 *
 * Both counts are optional: on GitHub the required number lives in branch
 * rulesets or in classic branch protection, which needs an administration
 * permission Homer doesn't ask for, so it is often unreadable. Approvals left
 * is only meaningful when the required count is known.
 */
export interface ApprovalInfo {
  approvers: GitUser[];
  approvalsRequired?: number;
  approvalsLeft?: number;
}
