import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from '@slack/web-api';
import { hasRelease, removeRelease, updateRelease } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { DataRelease } from '@/core/typings/Data';
import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
import type { ProviderType } from '@/core/typings/Provider';
import { buildReleaseMessage } from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import getReleaseOptions from '@/release/releaseOptions';
import ConfigHelper from '../../../utils/ConfigHelper';
import { buildReleaseStateNotificationMessage } from '../viewBuilders/buildReleaseStateNotificationMessage';

export interface DeploymentEvent {
  provider: ProviderType;
  projectId: number;
  project: { path_with_namespace: string; web_url: string };
  environment: string;
  status: 'failed' | 'running' | 'success';
  statusChangedAt: string;
  /** Release tag deployed. */
  ref: string;
  pipelineUrl?: string;
  /**
   * Given to release plugins: the full hook on GitLab, only `environment`,
   * `status` and `status_changed_at` on GitHub.
   */
  hook: GitlabDeploymentHook;
}

export async function handleDeploymentEvent(
  event: DeploymentEvent,
  acknowledge: (handled: boolean) => void,
): Promise<void> {
  const {
    environment,
    hook,
    pipelineUrl,
    project,
    projectId,
    provider,
    ref: releaseTagName,
    status,
    statusChangedAt,
  } = event;

  if (!(await hasRelease(projectId, releaseTagName, provider))) {
    acknowledge(false);
    return;
  }
  acknowledge(true);

  let updateGetter: (release: DataRelease) => Partial<DataRelease>;

  switch (status) {
    case 'failed':
      updateGetter = ({ failedDeployments }) => ({
        failedDeployments: [
          ...failedDeployments.filter(
            (failedDeployment) => failedDeployment.environment !== environment,
          ),
          { environment, date: statusChangedAt },
        ],
      });
      break;

    case 'running':
      updateGetter = ({ startedDeployments }) => ({
        startedDeployments: [
          ...startedDeployments.filter(
            (startedDeployment) =>
              startedDeployment.environment !== environment,
          ),
          { environment, date: statusChangedAt },
        ],
      });
      break;

    case 'success':
      updateGetter = ({ failedDeployments, successfulDeployments }) => ({
        failedDeployments: failedDeployments.filter(
          (failedDeployment) => failedDeployment.environment !== environment,
        ),
        successfulDeployments: [
          ...successfulDeployments.filter(
            (successfulDeployment) =>
              successfulDeployment.environment !== environment,
          ),
          { environment, date: statusChangedAt },
        ],
      });
      break;

    default:
      throw new Error(`Unhandled job status: ${status}`);
  }

  const release = await updateRelease(
    projectId,
    releaseTagName,
    updateGetter,
    provider,
  );
  const { notificationChannelIds, releaseChannelId, releaseManager } =
    await ConfigHelper.getProjectReleaseConfig(projectId, provider);

  const releaseStateUpdates = await releaseManager.getReleaseStateUpdate(
    release,
    hook,
    getReleaseOptions(),
  );

  if (releaseStateUpdates.length === 0) {
    return;
  }

  await Promise.all(
    notificationChannelIds.map(async (channelId) =>
      slackBotWebClient.chat.postMessage(
        buildReleaseStateNotificationMessage({
          channelId,
          pipelineUrl,
          provider,
          projectPathWithNamespace: project.path_with_namespace,
          projectWebUrl: project.web_url,
          releaseCreator: release.slackAuthor,
          releaseStateUpdates,
          releaseTagName,
        }),
      ),
    ),
  );

  const releaseMessage = buildReleaseMessage({
    releaseChannelId,
    release,
    releaseStateUpdates,
    project,
    pipelineUrl,
  });

  if (release.ts === undefined || release.ts === null) {
    const { ts } = await slackBotWebClient.chat.postMessage(
      releaseMessage as ChatPostMessageArguments,
    );
    await updateRelease(projectId, releaseTagName, () => ({ ts }), provider);
  } else {
    await slackBotWebClient.chat.update(releaseMessage as ChatUpdateArguments);
  }

  const isReleaseCompleted = releaseStateUpdates.some(
    (update) =>
      update.deploymentState === 'completed' &&
      ['production', 'support'].includes(update.environment),
  );

  if (isReleaseCompleted) {
    await removeRelease(projectId, releaseTagName, provider);
    return;
  }

  const isReleaseBeingMonitored = releaseStateUpdates.some(
    (update) =>
      update.deploymentState === 'monitoring' &&
      ['production', 'support'].includes(update.environment),
  );

  if (isReleaseBeingMonitored) {
    await updateRelease(
      projectId,
      releaseTagName,
      () => ({ state: 'monitoring' }),
      provider,
    );
  }
}
