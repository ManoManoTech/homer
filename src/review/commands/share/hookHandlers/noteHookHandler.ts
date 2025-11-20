import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { getReviewsByMergeRequestIid } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { getProjectIdValue } from '@/core/typings/Data';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import { StateUpdateDebouncer } from '../utils/StateUpdateDebouncer';
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
  res: Response
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

  await Promise.all(
    reviews
      .map((review) => {
        const { channelId, ts } = review;
        const reviewProjectId = getProjectIdValue(review);
        const shockAbsorberId = `${channelId}_${ts}_${object_attributes.author_id}`;

        if (!shockAbsorbers.has(shockAbsorberId)) {
          shockAbsorbers.set(
            shockAbsorberId,
            new StateUpdateDebouncer([], (state) => {
              shockAbsorbers.delete(shockAbsorberId);
              return buildNoteMessage(channelId, ts, state).then(
                slackBotWebClient.chat.postMessage
              );
            })
          );
        }

        const shockAbsorber: StateUpdateDebouncer<
          { author_id: number; note: string; url: string }[]
        > = shockAbsorbers.get(shockAbsorberId)!;

        shockAbsorber.state = [...shockAbsorber.state, object_attributes];

        return [
          buildReviewMessage(channelId, reviewProjectId, iid, ts).then(
            slackBotWebClient.chat.update
          ),
          shockAbsorber.promise,
        ];
      })
      .flat()
  );
}
