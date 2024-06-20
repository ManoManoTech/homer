import type { InputBlock, StaticSelect } from '@slack/web-api';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import type { SlackOption } from '@/core/typings/SlackOption';
import { cleanViewState } from '@/core/utils/cleanViewState';
import { buildChangelogModalView } from '../buildChangelogModalView';

export async function updateChangelog(payload: BlockActionsPayload) {
  const { blocks, callback_id, id, state, submit, title, type } = payload.view;
  const currentView = { blocks, callback_id, submit, title, type };
  const releaseTagInfoBlockIndex = blocks.findIndex(
    (block) => block.block_id === 'changelog-release-tag-info-block'
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
    state.values['changelog-project-block']?.['changelog-select-project-action']
      ?.selected_option?.value,
    10
  );

  const releaseTagName =
    state.values['changelog-release-tag-block']?.[
      'changelog-select-release-tag-action'
    ]?.selected_option?.value;

  const viewPromise = buildChangelogModalView({
    projectId,
    projectOptions: ((blocks[0] as InputBlock).element as StaticSelect)
      .options as SlackOption[],
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
