import type { ApprovalInfo } from '@/core/domain/ApprovalInfo';
import type { GitCommit } from '@/core/domain/GitCommit';
import type { MrAction } from '@/core/domain/GitEvent';
import type { GitUser } from '@/core/domain/GitUser';
import type { MergeRequest } from '@/core/domain/MergeRequest';
import type { MessageHandle } from '@/core/domain/MessageHandle';
import type { Repo } from '@/core/domain/RepoRef';

/**
 * Everything the review message shows, gathered by the caller so that the chat
 * platform's code only renders. Approvals and reviewers come from separate
 * provider requests, which is why they aren't part of the merge request itself.
 */
export interface ReviewSnapshot {
  mergeRequest: MergeRequest;
  repo: Repo;
  approvalInfo: ApprovalInfo;
  reviewers: GitUser[];
}

/** A comment left on the merge request. */
export interface ReviewNote {
  body: string;
  webUrl: string;
}

/**
 * What to say under an existing review message. Comments are grouped by author
 * because providers send a submitted review as a burst of one event per
 * comment.
 */
export type ThreadReply =
  | { type: 'merge_request_action'; action: MrAction; actor: GitUser }
  | { type: 'notes'; author: GitUser; notes: ReviewNote[] }
  | { type: 'commits'; commits: GitCommit[] };

/**
 * Posts and maintains the review message on the chat platform. The
 * implementation owns everything specific to that platform: how the message
 * looks, and which of its users a git user is.
 */
export interface ChatNotifier {
  postReview(channelId: string, review: ReviewSnapshot): Promise<MessageHandle>;

  updateReview(handle: MessageHandle, review: ReviewSnapshot): Promise<void>;

  postThreadReply(handle: MessageHandle, reply: ThreadReply): Promise<void>;

  deleteReview(handle: MessageHandle): Promise<void>;
}
