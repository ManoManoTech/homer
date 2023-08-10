import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionView } from '@/core/typings/BlockActionPayload';

export async function addLoaderToReleaseModal(view: BlockActionView) {
  const { blocks, callback_id, id, notify_on_close, submit, title, type } =
    view;
  const currentView = {
    blocks,
    callback_id,
    notify_on_close,
    submit,
    title,
    type,
  };

  view.blocks.push({
    type: 'section',
    text: {
      type: 'plain_text',
      text: ':loader:',
    },
  });

  await slackBotWebClient.views.update({
    view_id: id,
    view: currentView,
  });
}
