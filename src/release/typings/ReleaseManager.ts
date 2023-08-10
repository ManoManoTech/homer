import type { View } from '@slack/web-api';
import type {
  BlockActionsPayload,
  BlockActionView,
} from '@/core/typings/BlockActionPayload';
import type { DataRelease } from '@/core/typings/Data';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import type { SlackOption } from '@/core/typings/SlackOption';
import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
import type { ReleaseStateUpdate } from './ReleaseStateUpdate';

export interface ReleaseModalData {
  projectId: number;
  projectOptions: SlackOption[];
  view?: BlockActionView;
}

export interface ReleaseManager {
  blockActionsHandler?(
    payload: BlockActionsPayload,
    action: StaticSelectAction
  ): Promise<void>;
  buildReleaseModalView?(releaseModalData: ReleaseModalData): Promise<View>;
  filterChangelog?(commit: GitlabCommit, viewState: any): boolean;
  filterReleasesToClean?(
    newRelease: DataRelease,
    oldReleases: DataRelease[]
  ): DataRelease[];
  getReleaseStateUpdate(
    release: DataRelease,
    deploymentHook?: GitlabDeploymentHook
  ): Promise<ReleaseStateUpdate[]>;
  /**
   * Should be used to check whether release preconditions are ok.
   *
   * @example Build of docker images on master pipeline.
   */
  isReadyToRelease(
    release: DataRelease,
    mainBranchPipelineId: number
  ): Promise<boolean>;
}
