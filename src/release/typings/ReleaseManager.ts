import type { View } from '@slack/web-api';
import type { generateChangelog } from '@/changelog/utils/generateChangelog';
import type { slackifyChangelog } from '@/changelog/utils/slackifyChangelog';
import type {
  fetchPipelineBridges,
  fetchPipelineJobs,
  fetchProjectTags,
} from '@/core/services/gitlab';
import type { logger } from '@/core/services/logger';
import type { slackBotWebClient } from '@/core/services/slack';
import type {
  BlockActionsPayload,
  BlockActionView,
} from '@/core/typings/BlockActionPayload';
import type { DataRelease } from '@/core/typings/Data';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import type { SlackOption } from '@/core/typings/SlackOption';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import type { cleanViewState } from '@/core/utils/cleanViewState';
import type { addLoaderToReleaseModal } from '../commands/create/utils/addLoaderToReleaseModal';
import type { ReleaseStateUpdate } from './ReleaseStateUpdate';
import type { ReleaseTagManager } from './ReleaseTagManager';

export interface ReleaseModalData {
  projectId: number;
  projectOptions: SlackOption[];
  view?: BlockActionView;
}

export interface ReleaseOptions {
  changelog: { generateChangelog: typeof generateChangelog };
  gitlab: {
    fetchPipelineBridges: typeof fetchPipelineBridges;
    fetchPipelineJobs: typeof fetchPipelineJobs;
    fetchProjectTags: typeof fetchProjectTags;
  };
  release: {
    getReleaseManager: (managerName: string) => ReleaseManager | undefined;
    getReleaseTagManager: (
      tagManagerName: string
    ) => ReleaseTagManager | undefined;
  };
  slack: {
    slackifyChangelog: typeof slackifyChangelog;
    addLoaderToReleaseModal: typeof addLoaderToReleaseModal;
    cleanViewState: typeof cleanViewState;
    webClient: typeof slackBotWebClient;
  };
  logger: typeof logger;
}

export interface ReleaseManager {
  blockActionsHandler?(
    payload: BlockActionsPayload,
    action: StaticSelectAction,
    options?: ReleaseOptions
  ): Promise<void>;
  buildReleaseModalView?(
    releaseModalData: ReleaseModalData,
    options?: ReleaseOptions
  ): Promise<View>;
  filterChangelog?(
    commit: GitlabCommit,
    viewState: any,
    options?: ReleaseOptions
  ): boolean;
  filterReleasesToClean?(
    newRelease: DataRelease,
    oldReleases: DataRelease[],
    options?: ReleaseOptions
  ): DataRelease[];
  getReleaseStateUpdate(
    release: DataRelease,
    deploymentHook?: GitlabDeploymentHook,
    options?: ReleaseOptions
  ): Promise<ReleaseStateUpdate[]>;
  /**
   * Should be used to check whether release preconditions are ok.
   *
   * @example Build of docker images on master pipeline.
   */
  isReadyToRelease(
    release: DataRelease,
    mainBranchPipelineId: number,
    options?: ReleaseOptions
  ): Promise<boolean>;
}
