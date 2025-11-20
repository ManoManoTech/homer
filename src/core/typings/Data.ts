import type { SlackUser } from '@/core/typings/SlackUser';
import type { ProviderType } from '@/core/typings/UnifiedModels';
import type { ReleaseDeploymentInfo } from '@/release/typings/ReleaseDeploymentInfo';
import type { ReleaseState } from '@/release/typings/ReleaseState';

export interface DataProject {
  channelId: string;
  projectId?: number | null; // GitLab numeric ID (null for GitHub)
  projectIdString?: string | null; // GitHub owner/repo (null for GitLab)
  providerType: ProviderType;
}

export interface DataRelease {
  description: string;
  failedDeployments: ReleaseDeploymentInfo[];
  projectId: number; // GitLab project ID (release feature is GitLab-specific for now)
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
  projectId?: number | null; // GitLab numeric ID (null for GitHub)
  projectIdString?: string | null; // GitHub owner/repo (null for GitLab)
  providerType: ProviderType;
  ts: string;
}

export type DatabaseEntry<DataType> = DataType & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Helper function to get the actual project ID from DataProject or DataReview
 * Returns either the numeric projectId (GitLab) or projectIdString (GitHub)
 */
export function getProjectIdValue(
  data: Pick<
    DataProject | DataReview,
    'projectId' | 'projectIdString' | 'providerType'
  >
): number | string {
  if (data.providerType === 'gitlab' && data.projectId != null) {
    return data.projectId;
  }
  if (data.providerType === 'github' && data.projectIdString != null) {
    return data.projectIdString;
  }
  throw new Error(
    `Invalid project data: providerType=${data.providerType}, projectId=${data.projectId}, projectIdString=${data.projectIdString}`
  );
}
