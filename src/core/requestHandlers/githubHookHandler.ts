import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import {
  type GitHubProvider,
  toUnifiedUser,
} from '@/core/services/providers/GitHubProvider';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import type {
  GithubPullRequest,
  GithubRepository,
  GithubReview,
  GithubUser,
} from '@/core/typings/GithubModels';
import { handleNoteEvent } from '@/review/commands/share/events/handleNoteEvent';
import {
  handlePullRequestEvent,
  type PullRequestAction,
} from '@/review/commands/share/events/handlePullRequestEvent';
import { handlePushEvent } from '@/review/commands/share/events/handlePushEvent';

interface GithubComment {
  body: string;
  html_url: string;
  user: GithubUser;
}

interface GithubPushedCommit {
  id: string;
  message: string;
  url: string;
  author: { email: string };
  added?: string[];
  modified?: string[];
  removed?: string[];
}

interface GithubHookBody {
  action?: string;
  comment?: GithubComment;
  commits?: GithubPushedCommit[];
  issue?: { number: number; pull_request?: unknown };
  pull_request?: GithubPullRequest;
  ref?: string;
  repository: GithubRepository;
  review?: GithubReview;
  sender: GithubUser;
}

/**
 * Translates GitHub events into the provider-neutral review events.
 *
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads
 */
export async function githubHookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const event = req.header('X-GitHub-Event');
  const body = req.body as GithubHookBody;
  const acknowledge = (handled: boolean) =>
    res.sendStatus(handled ? HTTP_STATUS_OK : HTTP_STATUS_NO_CONTENT);

  const iid = body.pull_request?.number ?? body.issue?.number;
  if (iid !== undefined) {
    getGithubProvider().forgetPullRequest(body.repository.id, iid);
  }

  switch (event) {
    // Sent when the webhook is created.
    case 'ping':
      res.sendStatus(HTTP_STATUS_OK);
      return;

    case 'pull_request':
      return handlePullRequestHook(body, acknowledge);

    case 'pull_request_review':
      return handlePullRequestReviewHook(body, acknowledge);

    case 'pull_request_review_comment':
      if (body.action !== 'created' || !body.pull_request || !body.comment) {
        break;
      }
      return handleCommentHook(body, body.pull_request.number, acknowledge);

    case 'issue_comment':
      // Pull request comments are sent as issue comments.
      if (body.action !== 'created' || !body.issue?.pull_request) {
        break;
      }
      return handleCommentHook(body, body.issue.number, acknowledge);

    case 'push':
      return handlePushHook(body, acknowledge);

    default:
      break;
  }
  res.sendStatus(HTTP_STATUS_NO_CONTENT);
}

const PULL_REQUEST_ACTIONS: Record<string, PullRequestAction> = {
  assigned: 'update',
  converted_to_draft: 'update',
  edited: 'update',
  labeled: 'update',
  opened: 'open',
  ready_for_review: 'update',
  reopened: 'reopen',
  review_request_removed: 'update',
  review_requested: 'update',
  synchronize: 'update',
  unassigned: 'update',
  unlabeled: 'update',
};

async function handlePullRequestHook(
  { action, pull_request, repository, sender }: GithubHookBody,
  acknowledge: (handled: boolean) => void,
): Promise<void> {
  if (!pull_request || !action) {
    acknowledge(false);
    return;
  }

  const pullRequestAction: PullRequestAction | undefined =
    action === 'closed'
      ? pull_request.merged
        ? 'merge'
        : 'close'
      : PULL_REQUEST_ACTIONS[action];

  if (pullRequestAction === undefined) {
    acknowledge(false);
    return;
  }

  await handlePullRequestEvent(
    {
      provider: 'github',
      projectId: repository.id,
      iid: pull_request.number,
      action: pullRequestAction,
      labels: pull_request.labels.map(({ name }) => name),
      isMergeable: () =>
        getGithubProvider().isWaitingForApprovals(
          repository.id,
          pull_request.number,
        ),
      actor: toUnifiedUser(sender),
    },
    acknowledge,
  );
}

const REVIEW_ACTIONS: Partial<
  Record<GithubReview['state'], PullRequestAction>
> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
};

async function handlePullRequestReviewHook(
  { action, pull_request, repository, review, sender }: GithubHookBody,
  acknowledge: (handled: boolean) => void,
): Promise<void> {
  if (action !== 'submitted' || !pull_request || !review) {
    acknowledge(false);
    return;
  }

  // Review states are lowercase in webhooks and uppercase in the REST API.
  const state = review.state.toUpperCase() as GithubReview['state'];
  const ignore = () => undefined;

  // Two events are derived from one review: answer GitHub right away instead
  // of waiting for the comment debounce.
  acknowledge(true);

  await handlePullRequestEvent(
    {
      provider: 'github',
      projectId: repository.id,
      iid: pull_request.number,
      action: REVIEW_ACTIONS[state] ?? 'update',
      labels: pull_request.labels.map(({ name }) => name),
      isMergeable: false,
      actor: toUnifiedUser(sender),
    },
    ignore,
  );

  if (review.body) {
    await handleNoteEvent(
      {
        provider: 'github',
        projectId: repository.id,
        iid: pull_request.number,
        note: {
          author_id: sender.id,
          note: review.body,
          url: review.html_url,
        },
      },
      ignore,
    );
  }
}

async function handleCommentHook(
  { comment, repository }: GithubHookBody,
  iid: number,
  acknowledge: (handled: boolean) => void,
): Promise<void> {
  await handleNoteEvent(
    {
      provider: 'github',
      projectId: repository.id,
      iid,
      note: {
        author_id: comment!.user.id,
        note: comment!.body,
        url: comment!.html_url,
      },
    },
    acknowledge,
  );
}

async function handlePushHook(
  { commits, ref, repository }: GithubHookBody,
  acknowledge: (handled: boolean) => void,
): Promise<void> {
  if (!ref?.startsWith('refs/heads/')) {
    acknowledge(false);
    return;
  }

  await handlePushEvent(
    {
      provider: 'github',
      projectId: repository.id,
      branchName: ref.replace('refs/heads/', ''),
      commits: (commits ?? []).map((commit) => ({
        id: commit.id,
        title: commit.message.split('\n')[0],
        url: commit.url,
        authorEmail: commit.author.email,
        changesCount:
          (commit.added ?? []).length +
          (commit.modified ?? []).length +
          (commit.removed ?? []).length,
      })),
    },
    acknowledge,
  );
}

function getGithubProvider(): GitHubProvider {
  return getProvider('github') as GitHubProvider;
}
