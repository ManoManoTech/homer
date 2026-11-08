import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import type { GitlabProjectDetails } from '@/core/typings/GitlabProject';
import { handleNoteEvent } from '../events/handleNoteEvent';

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
      action?: string;
      author_id: number;
      note: string;
      url: string;
    };
    project: GitlabProjectDetails;
  };

  // merge_request is missing on commit or issue comments. Only new comments are
  // posted; GitLab sends no action before 16.11.
  if (
    !merge_request ||
    (object_attributes.action !== undefined &&
      object_attributes.action !== 'create')
  ) {
    res.sendStatus(HTTP_STATUS_NO_CONTENT);
    return;
  }

  await handleNoteEvent(
    {
      provider: 'gitlab',
      projectId: project.id,
      iid: merge_request.iid,
      note: object_attributes,
    },
    (handled) =>
      res.sendStatus(handled ? HTTP_STATUS_OK : HTTP_STATUS_NO_CONTENT),
  );
}
