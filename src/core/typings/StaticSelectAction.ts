import type { StaticSelect } from '@slack/web-api';

export interface StaticSelectAction extends StaticSelect {
  selected_option: { value: string };
}
