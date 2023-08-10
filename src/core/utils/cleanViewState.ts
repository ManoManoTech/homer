import type { View } from '@slack/types';

export function cleanViewState({
  blocks,
  state,
}: View & { state: { values: any } }) {
  Object.keys(state.values).forEach((blockId) => {
    if (!blocks.some(({ block_id }) => block_id === blockId)) {
      delete state.values[blockId];
    }
  });
}
