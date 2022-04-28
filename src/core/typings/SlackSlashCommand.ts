import { Request } from 'express';

export type SlackCommand = '/review' | string;

export type SlackSlashCommandResponse = {
  api_app_id: string;
  channel_id: string;
  channel_name: string;
  command: SlackCommand;
  response_url: string;
  team_domain: 'manomano-team' | string;
  team_id: string;
  text: string;
  token: string;
  trigger_id: string;
  user_id: string;
  user_name: string;
};

export type SlackExpressRequest = Request<any, any, SlackSlashCommandResponse>;
