import { isFromRepository } from '@/core/services/providers/GitHubProvider';
import type { DataRelease } from '@/core/typings/Data';
import type {
  ReleaseManager,
  ReleaseOptions,
} from '@/release/typings/ReleaseManager';
import defaultReleaseManager from './defaultReleaseManager';

const SUCCESSFUL_CONCLUSIONS = ['success', 'skipped', 'neutral'];

/**
 * Ready once every workflow run of the default branch head has succeeded.
 *
 * Deployments follow the default manager: GitHub `deployment_status` events
 * are given as hooks with `environment`, `status` and `status_changed_at`
 * only, so GitHub plugins must not read other GitLab hook fields.
 */
async function isReadyToRelease(
  { projectId }: DataRelease,
  mainBranchPipelineId: number,
  { github: { fetchWorkflowRun, fetchWorkflowRuns } }: ReleaseOptions,
): Promise<boolean> {
  const { head_branch, head_sha } = await fetchWorkflowRun(
    projectId,
    mainBranchPipelineId,
  );
  // Only pushes to the repository: fork pull requests can share branch names.
  const runs = (
    await fetchWorkflowRuns(projectId, { branch: head_branch, event: 'push' })
  ).filter(
    (run) => run.head_sha === head_sha && isFromRepository(run, projectId),
  );

  return (
    runs.length > 0 &&
    runs.every(
      ({ conclusion, status }) =>
        status === 'completed' &&
        SUCCESSFUL_CONCLUSIONS.includes(conclusion ?? ''),
    )
  );
}

const githubReleaseManager: ReleaseManager = {
  getReleaseStateUpdate: defaultReleaseManager.getReleaseStateUpdate,
  isReadyToRelease,
};

export default githubReleaseManager;
