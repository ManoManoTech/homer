import type { Request, Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { logger } from '@/core/services/logger';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import type { ModalViewSubmissionPayload } from '@/core/typings/ModalViewSubmissionPayload';
import { parseProjectRef } from '@/core/utils/projectRef';
import { createRelease } from './commands/create/utils/createRelease';
import { buildReleaseModalView } from './commands/create/viewBuilders/buildReleaseModalView';

export async function releaseViewSubmissionHandler(
  req: Request,
  res: Response,
  payload: ModalViewSubmissionPayload,
): Promise<void> {
  const { callback_id } = payload.view;

  switch (callback_id) {
    case 'release-create-modal': {
      const { view } = payload;
      const { state } = view;

      if (state.values['release-tag-block'] === undefined) {
        res.json({
          response_action: 'update',
          view: await buildReleaseModalView({ view }),
        });
        return;
      }

      const previousReleaseTagError = await getPreviousReleaseTagError(state);

      if (previousReleaseTagError !== undefined) {
        res.json({
          response_action: 'errors',
          errors: { 'release-previous-tag-block': previousReleaseTagError },
        });
        return;
      }
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      await createRelease(payload);
      break;
    }

    case 'release-changelog-modal': {
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      break;
    }

    default:
      res.sendStatus(HTTP_STATUS_NO_CONTENT);
      logger.error(
        new Error(`Unknown release view callback id: ${callback_id}`),
      );
  }
}

/**
 * Slack keeps the value of a select whose block_id and action_id are unchanged
 * between two views.update calls, and a tag can also be deleted while the modal
 * is open, so the submitted tag is checked before the release starts: telling
 * the user beats releasing against another project's changelog.
 */
async function getPreviousReleaseTagError(state: {
  values: Record<string, any>;
}): Promise<string | undefined> {
  const previousReleaseTagName: string | undefined =
    state.values['release-previous-tag-block']?.[
      'release-select-previous-tag-action'
    ]?.selected_option?.value;

  if (previousReleaseTagName === undefined) {
    return undefined;
  }

  const selectedProject: string | undefined =
    state.values['release-project-block']?.['release-select-project-action']
      ?.selected_option?.value;

  if (selectedProject === undefined) {
    return undefined;
  }

  const { projectId, provider } = parseProjectRef(selectedProject);

  if (Number.isNaN(projectId)) {
    return undefined;
  }

  return (await getProvider(provider).hasTag(projectId, previousReleaseTagName))
    ? undefined
    : `Tag ${previousReleaseTagName} does not belong to this project. Please select another previous release tag.`;
}
