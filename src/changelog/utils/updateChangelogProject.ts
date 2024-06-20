import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import { cleanViewState } from '@/core/utils/cleanViewState';
import { updateChangelog } from './updateChangelog';

export async function updateChangelogProject(payload: BlockActionsPayload) {
  const { blocks } = payload.view;
  const projectBlockIndex = blocks.findIndex(
    (block) => block.block_id === 'changelog-project-block'
  );

  blocks.splice(projectBlockIndex + 1);
  cleanViewState(payload.view);

  await updateChangelog(payload);
}
