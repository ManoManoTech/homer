import type { InputBlock, StaticSelect } from '@slack/web-api';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { SlackOption } from '@/core/typings/SlackOption';
import { cleanViewState } from '@/core/utils/cleanViewState';
import { getViewStateValue } from '@/core/utils/getViewStateValue';
import { buildChangelogModalView } from '../buildChangelogModalView';
import {
  CHANGELOG_RELEASE_TAG_INFO_BLOCK_ID,
  CHANGELOG_SELECT_PROJECT_ACTION_ID,
  CHANGELOG_SELECT_RELEASE_TAG_ACTION_ID,
} from '../changelogModalBlockIds';

export async function updateChangelog(payload: BlockActionsPayload) {
  const { blocks, callback_id, id, submit, title, type } = payload.view;
  const currentView = { blocks, callback_id, submit, title, type };
  const releaseTagInfoBlockIndex = blocks.findIndex(
    (block) => block.block_id === CHANGELOG_RELEASE_TAG_INFO_BLOCK_ID,
  );

  if (releaseTagInfoBlockIndex !== -1) {
    blocks.splice(releaseTagInfoBlockIndex + 1);
    cleanViewState(payload.view);
  }

  currentView.blocks.push({
    type: 'section',
    text: {
      type: 'plain_text',
      text: ':loader:',
    },
  });

  const projectId = parseInt(
    getViewStateValue(payload.view, CHANGELOG_SELECT_PROJECT_ACTION_ID)
      ?.selected_option?.value as string,
    10,
  );

  const releaseTagName = getViewStateValue(
    payload.view,
    CHANGELOG_SELECT_RELEASE_TAG_ACTION_ID,
  )?.selected_option?.value;

  const projectBlock = blocks.find(
    (block) =>
      ((block as InputBlock).element as StaticSelect)?.action_id ===
      CHANGELOG_SELECT_PROJECT_ACTION_ID,
  ) as InputBlock | undefined;

  const viewPromise = buildChangelogModalView({
    projectId,
    projectOptions: (projectBlock?.element as StaticSelect)
      ?.options as SlackOption[],
    releaseTagName,
  });

  // Loader
  await slackBotWebClient.views.update({
    view_id: id,
    view: currentView,
  });

  await slackBotWebClient.views.update({
    view_id: id,
    view: await viewPromise,
  });
}
