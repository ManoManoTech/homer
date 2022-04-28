import { logger } from '@/core/services/logger';
import { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { selectProject } from './commands/add/selectProject';
import { removeProject } from './commands/remove/removeProject';

export async function projectBlockActionsHandler(
  payload: BlockActionsPayload
): Promise<void> {
  await Promise.all(
    payload.actions.map(async (action) => {
      const { action_id } = action;

      switch (action_id) {
        case 'project-select-project-to-add':
          return selectProject(payload, action as StaticSelectAction);

        case 'project-select-project-to-remove':
          return removeProject(payload, action as StaticSelectAction);

        default:
          logger.error(new Error(`Unknown project block action: ${action_id}`));
      }
    })
  );
}
