import type { ModalView } from '@slack/web-api';

interface SubmittedModalView extends ModalView {
  app_id: string;
  app_installed_team_id: string;
  bot_id: string;
  hash: string;
  id: string;
  previous_view_id: null;
  root_view_id: string;
  state: { values: any };
  team_id: string;
}

export interface ModalViewSubmissionPayload {
  api_app_id: string;
  response_urls: {
    block_id: string;
    action_id: string;
    channel_id: string;
    response_url: string;
  }[];
  team: { id: string; domain: string };
  token: string;
  trigger_id: string;
  type: 'view_submission';
  user: {
    id: string;
    name: string;
    team_id: string;
    username: string;
  };
  view: SubmittedModalView;
}
