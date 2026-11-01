import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { getReviewsByMergeRequestIid } from '@/core/services/data';
import { fetchUserById } from '@/core/services/gitlab';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { StateUpdateDebouncer } from '../utils/StateUpdateDebouncer';
import { handleReviewWebhookError } from '../utils/handleReviewWebhookError';
import { buildNoteMessage } from '../viewBuilders/buildNoteMessage';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

// Prevents spam on threads when reviews are submitted on merge requests,
// because Gitlab sends all the note hooks at the same time.
const shockAbsorbers = new Map<
  string,
  StateUpdateDebouncer<{ author_id: number; note: string; url: string }[]>
>();

// Automated accounts (ex: CI report bots) post notes that are noise on Slack.
// The project can mute them with `ignoredNoteAuthorPattern`, matched against
// the username of the note author (`object_attributes.author_id`, not the hook's
// `user` which is the event actor), consistent with the author shown in the
// thread message. If the author cannot be fetched, the note is posted.
async function isIgnoredNoteAuthor(
  projectId: number,
  authorId: number,
): Promise<boolean> {
  const ignoredNoteAuthorRegex =
    await ConfigHelper.getIgnoredNoteAuthorRegex(projectId);

  if (ignoredNoteAuthorRegex === undefined) {
    return false;
  }
  const author = await fetchUserById(authorId).catch(() => undefined);

  return author !== undefined && ignoredNoteAuthorRegex.test(author.username);
}

export async function noteHookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { merge_request, object_attributes, project } = req.body as {
    merge_request: {
      author_id: number;
      iid: number;
    };
    object_attributes: { author_id: number; note: string; url: string };
    project: GitlabProjectDetails;
  };

  // Happens whether comment is on commit or issue
  if (!merge_request) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  const { iid } = merge_request;
  const reviews = await getReviewsByMergeRequestIid(project.id, iid);

  if (reviews.length === 0) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }
  res.sendStatus(HTTP_STATUS_OK);

  // The review messages are still refreshed (comment count), only the thread
  // message is skipped.
  const isIgnored = await isIgnoredNoteAuthor(
    project.id,
    object_attributes.author_id,
  );

  await Promise.all(
    reviews.map(async ({ channelId, ts }) => {
      const shockAbsorberId = `${channelId}_${ts}_${object_attributes.author_id}`;

      if (!isIgnored && !shockAbsorbers.has(shockAbsorberId)) {
        shockAbsorbers.set(
          shockAbsorberId,
          new StateUpdateDebouncer([], (state) => {
            shockAbsorbers.delete(shockAbsorberId);
            return buildNoteMessage(channelId, ts, state).then(
              slackBotWebClient.chat.postMessage,
            );
          }),
        );
      }

      const shockAbsorber:
        | StateUpdateDebouncer<
            { author_id: number; note: string; url: string }[]
          >
        | undefined = isIgnored
        ? undefined
        : shockAbsorbers.get(shockAbsorberId)!;

      if (shockAbsorber) {
        shockAbsorber.state = [...shockAbsorber.state, object_attributes];
      }

      try {
        await Promise.all([
          buildReviewMessage(channelId, project.id, iid, ts).then(
            slackBotWebClient.chat.update,
          ),
          shockAbsorber?.promise,
        ]);
      } catch (err) {
        await handleReviewWebhookError(err, {
          hook: 'note',
          mrIid: iid,
          projectId: project.id,
          channelId,
          reviewTs: ts,
        });
      }
    }),
  );
}
