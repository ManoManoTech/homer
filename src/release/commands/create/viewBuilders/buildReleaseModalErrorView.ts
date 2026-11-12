import type { KnownBlock, View } from '@slack/web-api';
import type { BlockActionView } from '@/core/typings/BlockActionPayload';

// Error messages can carry whole API responses.
const MAX_ERROR_LENGTH = 500;

/**
 * Replaces the loader when the release modal cannot be built. The project
 * select is kept when known, so the user can switch to another project or
 * submit to rebuild the modal. Without it, a rebuild has nothing to start
 * from, so the modal offers no retry.
 */
export function buildReleaseModalErrorView(
  error: unknown,
  view?: BlockActionView,
): View {
  const projectBlock = view?.blocks.find(
    (block) => block.block_id === 'release-project-block',
  );
  const message = error instanceof Error ? error.message : String(error);

  return {
    type: 'modal',
    callback_id: 'release-create-modal',
    title: { type: 'plain_text', text: 'Release' },
    ...(projectBlock ? { submit: { type: 'plain_text', text: 'Retry' } } : {}),
    notify_on_close: false,
    blocks: [
      ...(projectBlock ? [projectBlock as KnownBlock] : []),
      {
        type: 'section',
        block_id: 'release-error-block',
        text: {
          type: 'plain_text',
          text: `Homer could not load the release data: ${message.slice(0, MAX_ERROR_LENGTH)}`,
        },
      },
    ],
  };
}
