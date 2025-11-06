import type { Actionable, ModalView, View } from '@slack/web-api';

export type BlockActionView<V extends View = ModalView> = V & {
  id: string;
  team_id: string;
  state: { values: any };
  hash: string;
  root_view_id: string;
  app_id: string;
  app_installed_team_id: string;
  bot_id: string;
};

export interface BlockActionsPayload<V extends View = ModalView> {
  actions: Actionable[];
  api_app_id: string;
  container: {
    type: string;
    message_ts: string;
    attachment_id: 1;
    channel_id: string;
    is_ephemeral: false;
    is_app_unfurl: false;
  };
  message: {
    bot_id: string;
    text: string;
    ts: string;
    type: string;
    user: string;
  };
  response_url: string;
  team: {
    id: string;
    domain: string;
  };
  token: string;
  trigger_id: string;
  type: 'block_actions';
  user: {
    id: string;
    username: string;
    team_id: string;
  };
  view: BlockActionView<V>;
}

export interface BlockActionsPayloadWithChannel<V extends View = ModalView>
  extends BlockActionsPayload<V> {
  channel: {
    id: string;
    name: string;
  };
}
