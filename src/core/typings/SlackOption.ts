import type { Option } from '@slack/web-api';

export type SlackOption = Option & {
  value: string;
};
