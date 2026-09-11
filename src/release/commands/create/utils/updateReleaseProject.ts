import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import { cleanViewState } from '@/core/utils/cleanViewState';
import { buildReleaseModalView } from '../viewBuilders/buildReleaseModalView';
import { RELEASE_PROJECT_BLOCK_ID } from '../viewBuilders/releaseModalBlockIds';
import { addLoaderToReleaseModal } from './addLoaderToReleaseModal';

export async function updateReleaseProject({ view }: BlockActionsPayload) {
  const { blocks, id } = view;
  const projectBlockIndex = blocks.findIndex(
    (block) => block.block_id === RELEASE_PROJECT_BLOCK_ID,
  );

  blocks.splice(projectBlockIndex + 1);
  cleanViewState(view);

  const viewPromise = buildReleaseModalView({ view });

  await addLoaderToReleaseModal(view);

  await slackBotWebClient.views.update({
    view_id: id,
    view: await viewPromise,
  });
}
