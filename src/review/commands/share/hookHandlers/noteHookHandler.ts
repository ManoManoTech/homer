import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { getReviewsByMergeRequestIid } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
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

export async function noteHookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { merge_request, object_attributes, project } = req.body as {
    merge_request: {
      author_id: number;
      iid: number;
    };
    object_attributes: {
      action?: 'create' | 'update';
      author_id: number;
      note: string;
      url: string;
    };
    project: GitlabProjectDetails;
  };

  // merge_request is missing on commit or issue comments, and an edited
  // comment was already posted when it was created.
  if (!merge_request || object_attributes.action === 'update') {
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

  await Promise.all(
    reviews.map(async ({ channelId, ts }) => {
      const shockAbsorberId = `${channelId}_${ts}_${object_attributes.author_id}`;

      if (!shockAbsorbers.has(shockAbsorberId)) {
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

      const shockAbsorber: StateUpdateDebouncer<
        { author_id: number; note: string; url: string }[]
      > = shockAbsorbers.get(shockAbsorberId)!;

      shockAbsorber.state = [...shockAbsorber.state, object_attributes];

      try {
        await Promise.all([
          buildReviewMessage(channelId, project.id, iid, ts).then(
            slackBotWebClient.chat.update,
          ),
          shockAbsorber.promise,
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
