import { logger } from '@/core/services/logger';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import { updateChangelog } from './utils/updateChangelog';
import { updateChangelogProject } from './utils/updateChangelogProject';

export async function changelogBlockActionsHandler(
  payload: BlockActionsPayload
): Promise<void> {
  await Promise.all(
    payload.actions.map(async (action) => {
      const { action_id } = action;

      switch (action_id) {
        case 'changelog-select-project-action':
          return updateChangelogProject(payload);

        case 'changelog-select-release-tag-action':
          return updateChangelog(payload);

        default:
          logger.error(
            new Error(`Unknown changelog block action: ${action_id}`)
          );
      }
    })
  );
}
