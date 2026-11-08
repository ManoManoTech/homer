import type { ProviderType } from '@/core/typings/Provider';
import type { SlackUser } from '@/core/typings/SlackUser';
import type { ReleaseDeploymentInfo } from '@/release/typings/ReleaseDeploymentInfo';
import type { ReleaseState } from '@/release/typings/ReleaseState';

export interface DataProject {
  channelId: string;
  projectId: number;
  provider: ProviderType;
}

export interface DataRelease {
  description: string;
  failedDeployments: ReleaseDeploymentInfo[];
  projectId: number;
  /** Missing on releases created before GitHub support: they are GitLab. */
  provider?: ProviderType;
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
  provider: ProviderType;
  ts: string;
}

export type DatabaseEntry<DataType> = DataType & {
  id: number;
  createdAt: string;
  updatedAt: string;
};
