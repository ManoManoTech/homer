import type { SlackUser } from '@/core/typings/SlackUser';
import type { ReleaseDeploymentInfo } from '@/release/typings/ReleaseDeploymentInfo';
import type { ReleaseState } from '@/release/typings/ReleaseState';

export interface DataProject {
  channelId: string;
  projectId: number;
}

export interface DataRelease {
  description: string;
  failedDeployments: ReleaseDeploymentInfo[];
  projectId: number;
  slackAuthor: SlackUser;
  startedDeployments: ReleaseDeploymentInfo[];
  state: ReleaseState;
  successfulDeployments: ReleaseDeploymentInfo[];
  tagName: string;
  ts?: string;
}

export interface DataReleaseInternal
  extends Omit<
    DataRelease,
    | 'failedDeployments'
    | 'slackAuthor'
    | 'startedDeployments'
    | 'successfulDeployments'
  > {
  failedDeployments: string; // stored as json
  slackAuthor: string; // stored as json
  startedDeployments: string; // stored as json
  successfulDeployments: string; // stored as json
}

export interface DataReview {
  channelId: string;
  mergeRequestIid: number;
  projectId: number;
  ts: string;
}

export interface DataReviewReminder {
  channelId: string;
  /** Days of the week the reminder is posted on, from 0 (Sunday) to 6. */
  days: number[];
  /** Consecutive failed attempts to post the reminder of the current day. */
  failedAttempts: number;
  /** Day of the last reminder sent, formatted as `YYYY-MM-DD` (in `REVIEW_REMINDER_TIMEZONE`). */
  lastSentOn: string | null;
  /** Time from which the reminder is posted, formatted as `HH:mm` (in `REVIEW_REMINDER_TIMEZONE`). */
  time: string;
}

export interface DataReviewReminderInternal
  extends Omit<DataReviewReminder, 'days'> {
  days: string; // stored as comma-separated list
}

export type DatabaseEntry<DataType> = DataType & {
  id: number;
  createdAt: string;
  updatedAt: string;
};
