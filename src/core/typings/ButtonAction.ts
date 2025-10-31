import type { Button } from '@slack/web-api';

export interface ButtonAction extends Button {
  value: string;
}
