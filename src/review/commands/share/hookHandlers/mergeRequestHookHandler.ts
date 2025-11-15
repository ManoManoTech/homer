import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import {
  addReviewToChannel,
  getChannelsByProjectId,
  getReviewsByMergeRequestIid,
  removeReviewsByMergeRequestIid,
} from '@/core/services/data';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
import {
  fetchSlackUserFromGitlabUsername,
  slackBotWebClient,
} from '@/core/services/slack';
import { getProjectIdValue } from '@/core/typings/Data';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

const VALID_ACTIONS = [
  'approved',
  'close',
  'merge',
  'reopen',
  'update',
  'open',
  'unapproved',
] as const;

// Map GitHub actions to GitLab-style actions
const GITHUB_ACTION_MAP: Record<string, string> = {
  opened: 'open',
  reopened: 'reopen',
  closed: 'close',
  synchronize: 'update', // When new commits are pushed
  edited: 'update',
  dismissed: 'unapproved', // From pull_request_review webhook (when review is dismissed)
};
const LABELS = {
  REVIEW: 'homer-review',
  MERGEABLE: 'homer-mergeable',
} as const;

interface ThreadMessage {
  text: string;
  icon_emoji: string;
}

export async function mergeRequestHookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  // Detect provider type and extract data accordingly
  const isGitLab = !!req.body.object_kind;

  let projectId: string | number;
  let iid: number;
  let action: string;
  let labels: Array<{ title: string }>;
  let username: string;
  let detailed_merge_status: string | undefined;

  if (isGitLab) {
    // GitLab webhook structure
    const gitlabData = req.body;
    if (
      !gitlabData.object_attributes ||
      !gitlabData.project ||
      !gitlabData.user
    ) {
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      return;
    }

    projectId = gitlabData.project.id;
    iid = gitlabData.object_attributes.iid;
    action = gitlabData.object_attributes.action;
    labels = gitlabData.labels || [];
    username = gitlabData.user.username;
    detailed_merge_status = gitlabData.object_attributes.detailed_merge_status;
  } else {
    // GitHub webhook structure
    const githubData = req.body;
    if (
      !githubData.pull_request ||
      !githubData.repository ||
      !githubData.sender
    ) {
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      return;
    }

    projectId = githubData.repository.full_name;
    iid = githubData.pull_request.number;

    // Map GitHub action to GitLab-style action
    const githubAction = githubData.action;

    // For pull_request_review webhooks, check the review state
    if (githubAction === 'submitted' && githubData.review) {
      const reviewState = githubData.review.state;
      if (reviewState === 'approved') {
        action = 'approved';
      } else if (
        reviewState === 'changes_requested' ||
        reviewState === 'dismissed'
      ) {
        action = 'unapproved';
      } else {
        // 'commented' state - treat as update
        action = 'update';
      }
    } else {
      action = GITHUB_ACTION_MAP[githubAction] || githubAction;
    }

    // Check if PR was merged (GitHub sends 'closed' action with merged=true)
    if (githubAction === 'closed' && githubData.pull_request.merged) {
      action = 'merge';
    }

    labels =
      githubData.pull_request.labels?.map((l: any) => ({ title: l.name })) ||
      [];
    username = githubData.sender.login;
    // GitHub doesn't have detailed_merge_status, use mergeable state
    detailed_merge_status = githubData.pull_request.mergeable
      ? 'mergeable'
      : undefined;
  }

  if (!VALID_ACTIONS.includes(action as any)) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  const reviews = await getReviewsByMergeRequestIid(projectId, iid);

  if (reviews.length === 0) {
    const hasReviewLabel = labels.some(
      (label: { title: string }) => label.title === LABELS.REVIEW,
    );
    const isMergeable =
      labels.some(
        (label: { title: string }) => label.title === LABELS.MERGEABLE,
      ) && ['mergeable', 'not_approved'].includes(detailed_merge_status || '');

    if (hasReviewLabel || isMergeable) {
      await handleNewReview(projectId, iid);
      res.sendStatus(HTTP_STATUS_OK);
      return;
    }
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  const user = await fetchSlackUserFromGitlabUsername(username);
  if (!user) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  res.sendStatus(HTTP_STATUS_OK);

  const threadMessage = getThreadMessage(action, user.real_name);

  await Promise.all(
    reviews.map(async (review) => {
      const reviewProjectId = getProjectIdValue(review);
      const updates = [
        buildReviewMessage(
          review.channelId,
          reviewProjectId,
          iid,
          review.ts,
        ).then(slackBotWebClient.chat.update),
        threadMessage &&
          slackBotWebClient.chat.postMessage({
            channel: review.channelId,
            thread_ts: review.ts,
            ...threadMessage,
          }),
      ].filter(Boolean);
      return Promise.all(updates);
    }),
  );

  if (['close', 'merge'].includes(action)) {
    await removeReviewsByMergeRequestIid(iid);
  }
}

async function handleNewReview(
  projectId: number | string,
  iid: number,
): Promise<void> {
  const configuredChannels = await getChannelsByProjectId(projectId);

  if (configuredChannels.length === 0) {
    return;
  }

  const providerType = ProviderFactory.detectProviderType(projectId);

  await Promise.all(
    configuredChannels.map(async ({ channelId }) => {
      const { ts } = await slackBotWebClient.chat.postMessage(
        await buildReviewMessage(channelId, projectId, iid),
      );
      await addReviewToChannel({
        channelId,
        mergeRequestIid: iid,
        projectId: typeof projectId === 'number' ? projectId : null,
        projectIdString: typeof projectId === 'string' ? projectId : null,
        providerType,
        ts: ts as string,
      });
    }),
  );
}

function getThreadMessage(
  action: string,
  userName: string,
): ThreadMessage | undefined {
  const messages: Record<string, ThreadMessage> = {
    approved: {
      text: `*${userName}* has approved this merge request.`,
      icon_emoji: ':thumbsup_blue:',
    },
    close: {
      text: `*${userName}* has closed this merge request.`,
      icon_emoji: ':closed_book_blue:',
    },
    merge: {
      text: `*${userName}* has merged this merge request.`,
      icon_emoji: ':git-merge:',
    },
    unapproved: {
      text: `*${userName}* has unapproved this merge request.`,
      icon_emoji: ':thumbsdown_blue:',
    },
  };
  return messages[action];
}
