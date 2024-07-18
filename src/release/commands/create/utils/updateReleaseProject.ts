import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import { cleanViewState } from '@/core/utils/cleanViewState';
import { buildReleaseModalView } from '../viewBuilders/buildReleaseModalView';
import { addLoaderToReleaseModal } from './addLoaderToReleaseModal';

export async function updateReleaseProject({ view }: BlockActionsPayload) {
  const { blocks, id } = view;
  const projectBlockIndex = blocks.findIndex(
    (block) => block.block_id === 'release-project-block'
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
