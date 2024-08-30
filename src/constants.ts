import type { GitlabMergeRequestState } from '@/core/typings/GitlabMergeRequest';

export const CHANNEL_NOT_FOUND_SLACK_ERROR = 'channel_not_found';
export const EXPIRED_TRIGGER_ID_ERROR_MESSAGE =
  'D’oh! It looks like I took too much time to respond for Slack, could you retry your command? :homer-donut:';
export const EXPIRED_TRIGGER_ID_SLACK_ERROR = 'expired_trigger_id';
export const GENERIC_ERROR_MESSAGE =
  "D'oh! Something went wrong :homer-stressed:";
export const HOMER_GIT_URL = `https://github.com/ManoManoTech/homer/`;
export const HTTP_STATUS_NO_CONTENT = 204;
export const HTTP_STATUS_OK = 200;
export const MERGE_REQUEST_CLOSE_STATES: GitlabMergeRequestState[] = [
  'closed',
  'merged',
];
export const MERGE_REQUEST_OPEN_STATES: GitlabMergeRequestState[] = [
  'locked',
  'opened',
  'reopened',
];

export const PRIVATE_CHANNEL_ERROR_MESSAGE =
  'D’oh! It looks like you tried to use me on a private channel I’m not in. Please invite me using `/invite @homer` so I can publish messages :homer-donut:';
export const REQUEST_BODY_SIZE_LIMIT = '500kb';
export const SEPARATOR = '-:-';
