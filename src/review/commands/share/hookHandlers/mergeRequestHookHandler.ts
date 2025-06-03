import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import {
  addReviewToChannel,
  getChannelsByProjectId,
  getReviewsByMergeRequestIid,
  removeReviewsByMergeRequestIid,
} from '@/core/services/data';
import {
  fetchSlackUserFromGitlabUsername,
  slackBotWebClient,
} from '@/core/services/slack';
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
  res: Response
): Promise<void> {
  const {
    object_attributes: { detailed_merge_status, action, iid },
    labels,
    project: { id: projectId },
    user: { username },
  } = req.body;

  if (!VALID_ACTIONS.includes(action as any)) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  const reviews = await getReviewsByMergeRequestIid(projectId, iid);

  if (reviews.length === 0) {
    const hasReviewLabel = labels.some(
      (label: { title: string }) => label.title === LABELS.REVIEW
    );
    const isMergeable =
      labels.some(
        (label: { title: string }) => label.title === LABELS.MERGEABLE
      ) && detailed_merge_status === 'mergeable';

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
    reviews.map(async ({ channelId, ts }) => {
      const updates = [
        buildReviewMessage(channelId, projectId, iid, ts).then(
          slackBotWebClient.chat.update
        ),
        threadMessage &&
          slackBotWebClient.chat.postMessage({
            channel: channelId,
            thread_ts: ts,
            ...threadMessage,
          }),
      ].filter(Boolean);
      return Promise.all(updates);
    })
  );

  if (['close', 'merge'].includes(action)) {
    await removeReviewsByMergeRequestIid(iid);
  }
}

async function handleNewReview(projectId: number, iid: number): Promise<void> {
  const configuredChannels = await getChannelsByProjectId(projectId);

  if (configuredChannels.length === 0) {
    return;
  }

  await Promise.all(
    configuredChannels.map(async ({ channelId }) => {
      const { ts } = await slackBotWebClient.chat.postMessage(
        await buildReviewMessage(channelId, projectId, iid)
      );
      await addReviewToChannel({
        channelId,
        mergeRequestIid: iid,
        projectId,
        ts: ts as string,
      });
    })
  );
}

function getThreadMessage(
  action: string,
  userName: string
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
