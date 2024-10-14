import { logger } from '@/core/services/logger';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import { selectReleaseToCancel } from './commands/cancel/selectReleaseToCancel';
import { updateReleaseChangelog } from './commands/create/utils/updateReleaseChangelog';
import { updateReleaseProject } from './commands/create/utils/updateReleaseProject';
import { selectReleaseToEnd } from './commands/end/selectReleaseToEnd';
import getReleaseOptions from './releaseOptions';
import ConfigHelper from './utils/ConfigHelper';

export async function releaseBlockActionsHandler(
  payload: BlockActionsPayload
): Promise<void> {
  await Promise.all(
    payload.actions.map(async (action) => {
      const { action_id } = action;

      switch (action_id) {
        case 'release-select-previous-tag-action':
          return updateReleaseChangelog(payload);

        case 'release-select-project-action':
          return updateReleaseProject(payload);

        case 'release-select-release-cancel-action':
          return selectReleaseToCancel(payload, action as StaticSelectAction);

        case 'release-select-release-end-action':
          return selectReleaseToEnd(payload, action as StaticSelectAction);

        default: {
          const { state } = payload.view;
          const projectId = parseInt(
            state.values['release-project-block']?.[
              'release-select-project-action'
            ]?.selected_option?.value,
            10
          );
          const { releaseManager } = await ConfigHelper.getProjectReleaseConfig(
            projectId
          );

          if (releaseManager.blockActionsHandler !== undefined) {
            return releaseManager.blockActionsHandler(
              payload,
              action as StaticSelectAction,
              getReleaseOptions()
            );
          }
          logger.error(new Error(`Unknown block action: ${action_id}`));
        }
      }
    })
  );
}
