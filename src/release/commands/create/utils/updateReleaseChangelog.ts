import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import { cleanViewState } from '@/core/utils/cleanViewState';
import { isHashConflictError } from '@/core/utils/isHashConflictError';
import { buildReleaseModalView } from '../viewBuilders/buildReleaseModalView';
import { addLoaderToReleaseModal } from './addLoaderToReleaseModal';

export async function updateReleaseChangelog({ view }: BlockActionsPayload) {
  const { blocks, id } = view;
  const previousReleaseInfoBlockIndex = blocks.findIndex(
    (block) => block.block_id === 'release-previous-tag-info-block',
  );

  if (previousReleaseInfoBlockIndex !== -1) {
    blocks.splice(previousReleaseInfoBlockIndex + 1);
    cleanViewState(view);
  }

  const viewPromise = buildReleaseModalView({ view });

  const hash = await addLoaderToReleaseModal(view);

  try {
    await slackBotWebClient.views.update({
      hash,
      view_id: id,
      view: await viewPromise,
    });
  } catch (error) {
    // Another interaction rebuilt the modal in the meantime: its rebuild is the
    // current one, so discarding this outdated view is the expected outcome.
    if (!isHashConflictError(error)) {
      throw error;
    }
    logger.debug(
      { viewId: id },
      'Release modal rebuild discarded: a more recent interaction superseded it',
    );
  }
}
