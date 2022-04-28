import { GitlabMergeRequestState } from '@/core/typings/GitlabMergeRequest';

export const CHANNEL_NOT_FOUND_SLACK_ERROR = 'channel_not_found';
export const GENERIC_ERROR_MESSAGE =
  "D'oh! Something went wrong :homer-stressed: You will probably find more information on the error on <https://app.datadoghq.eu/logs?cols=host%2Cservice&live=true&messageDisplay=inline&query=service%3A%2Ahomer%2A%20%40env%3Asupport&index=%2A&stream_sort=desc|Datadog>.";
export const GITLAB_URL = 'https://git.manomano.tech';
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
export const MOES_TAVERN_CHANNEL_ID = 'C01FCCQGP3M';
export const PRIVATE_CHANNEL_ERROR_MESSAGE =
  "D'oh! It looks like you tried to use me on a private channel. Unfortunately, I'm a bit stupid and I don't know how to manage them :homer-donut:";
