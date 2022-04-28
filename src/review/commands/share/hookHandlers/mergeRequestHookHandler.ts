import { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import {
  getReviewsByMergeRequestIid,
  removeReviewsByMergeRequestIid,
} from '@/core/services/data';
import {
  fetchSlackUserFromGitlabUsername,
  slackWebClient,
} from '@/core/services/slack';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

export async function mergeRequestHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const {
    object_attributes: { action, iid },
    project: { id: projectId },
    user: { username },
  } = req.body;

  if (
    !['approved', 'close', 'merge', 'reopen', 'update', 'unapproved'].includes(
      action
    )
  ) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  const reviews = await getReviewsByMergeRequestIid(projectId, iid);

  if (reviews.length === 0) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  const user = await fetchSlackUserFromGitlabUsername(username);

  if (user === undefined) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }
  res.sendStatus(HTTP_STATUS_OK);

  let threadMessage: { icon_emoji: string; text: string };

  switch (action) {
    case 'approved':
      threadMessage = {
        text: `${user.real_name} has approved this merge request`,
        icon_emoji: ':+1:',
      };
      break;

    case 'close':
      threadMessage = {
        text: `${user.real_name} has closed this merge request`,
        icon_emoji: ':closed_book:',
      };
      break;

    case 'merge':
      threadMessage = {
        text: `${user.real_name} has merged this merge request`,
        icon_emoji: ':ok_hand:',
      };
      break;

    case 'reopen':
      threadMessage = {
        text: `${user.real_name} has reopened this merge request`,
        icon_emoji: ':open_book:',
      };
      break;

    case 'unapproved':
      threadMessage = {
        text: `${user.real_name} has unapproved this merge request`,
        icon_emoji: ':-1:',
      };
      break;

    default:
    // Nothing to do
  }

  await Promise.all(
    reviews
      .map(async ({ channelId, ts }) =>
        [
          buildReviewMessage(channelId, projectId, iid, ts).then(
            slackWebClient.chat.update
          ),
          threadMessage &&
            slackWebClient.chat.postMessage({
              channel: channelId,
              thread_ts: ts,
              ...threadMessage,
            }),
        ].filter(Boolean)
      )
      .flat()
  );

  if (['close', 'merge'].includes(action)) {
    await removeReviewsByMergeRequestIid(iid);
  }
}
