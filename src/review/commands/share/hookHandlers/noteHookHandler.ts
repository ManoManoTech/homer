import { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { getReviewsByMergeRequestIid } from '@/core/services/data';
import { slackWebClient } from '@/core/services/slack';
import { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import { buildNoteMessage } from '../viewBuilders/buildNoteMessage';
import { buildReviewMessage } from '../viewBuilders/buildReviewMessage';

export async function noteHookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { merge_request, object_attributes, project } = req.body as {
    merge_request: {
      author_id: number;
      iid: number;
    };
    object_attributes: { author_id: number };
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
      .map(({ channelId, ts }) => [
        buildReviewMessage(channelId, project.id, iid, ts).then(
          slackWebClient.chat.update
        ),
        buildNoteMessage(channelId, ts, object_attributes).then(
          slackWebClient.chat.postMessage
        ),
      ])
      .flat()
  );
}
