import type { KnownBlock } from '@slack/types';
import type {
  ChatPostMessageArguments,
  ChatUpdateArguments,
} from '@slack/web-api';
import slackifyMarkdown from 'slackify-markdown';
import type { DataRelease } from '@/core/typings/Data';
import type { SlackUser } from '@/core/typings/SlackUser';
import { capitalizeFirstLetter } from '@/core/utils/capitalizeFirstLetter';
import { injectActionsParameters } from '@/core/utils/slackActions';
import type {
  DeploymentState,
  ReleaseEnvironment,
  ReleaseStateUpdate,
} from '../../../typings/ReleaseStateUpdate';

interface ReleaseMessageData {
  releaseChannelId: string;
  release: DataRelease;
  releaseStateUpdates: ReleaseStateUpdate[];
  project: ReleaseMessageProjectData;
  pipelineUrl?: string;
}

interface ReleaseMessageProjectData {
  path_with_namespace: string;
  web_url: string;
}

const CHANGELOG_SUMMARY_DISPLAY_COUNT = 3;
const FINAL_RELEASE_ENVIRONMENTS: ReleaseEnvironment[] = [
  'production',
  'support',
];

export function buildReleaseMessage({
  releaseChannelId,
  release,
  releaseStateUpdates,
  project,
  pipelineUrl,
}: ReleaseMessageData): ChatPostMessageArguments | ChatUpdateArguments {
  const { description, tagName, slackAuthor } = release;
  const { path_with_namespace, web_url } = project;

  const blocks = [
    buildHeaderBlock(path_with_namespace, releaseStateUpdates),
    ...buildReleaseDataBlocks(web_url, slackAuthor, tagName, description),
    buildActionBlock(release, pipelineUrl),
  ] as KnownBlock[];

  if (releaseStateUpdates.length > 0) {
    blocks.push(...buildDeploymentBlock(release, releaseStateUpdates));
  }

  return {
    channel: releaseChannelId,
    ts: release.ts,
    link_names: true,
    icon_url: slackAuthor.profile.image_72,
    username: slackAuthor.real_name,
    blocks: blocks,
  };
}

function buildHeaderBlock(
  projectPathWithNamespace: string,
  releaseStateUpdates: ReleaseStateUpdate[],
): KnownBlock {
  const DEPLOYMENT_STATE_COMPLETED: DeploymentState = 'completed';

  const projectDisplayName =
    projectPathWithNamespace.split('/').pop() ?? projectPathWithNamespace;

  const isReleaseCompleted = releaseStateUpdates.some(
    (update) =>
      update.deploymentState === DEPLOYMENT_STATE_COMPLETED &&
      FINAL_RELEASE_ENVIRONMENTS.includes(update.environment),
  );

  const releaseInfo = isReleaseCompleted
    ? { status: 'Completed', emoji: '✅' }
    : { status: 'In Progress', emoji: '🚀' };

  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${releaseInfo.emoji} Release ${releaseInfo.status}: ${projectDisplayName}`,
      emoji: true,
    },
  };
}

function buildReleaseDataBlocks(
  projectWebUrl: string,
  releaseCreator: SlackUser,
  releaseTagName: string,
  releaseDescription: string,
): KnownBlock[] {
  return [
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Version:*\n\`<${projectWebUrl}/-/releases/${releaseTagName}|${releaseTagName}>\``,
        },
        {
          type: 'mrkdwn',
          text: `*Initiated by:*\n@${releaseCreator.name}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: createChangelogSummary(releaseDescription),
      },
    },
  ];
}

function buildActionBlock(
  release: DataRelease,
  pipelineUrl?: string,
): KnownBlock {
  return {
    type: 'actions',
    elements: [
      ...(pipelineUrl
        ? [
            {
              type: 'button',
              url: pipelineUrl,
              action_id: 'not-interactive',
              text: {
                type: 'plain_text',
                text: 'View Pipeline',
                emoji: true,
              },
            },
          ]
        : []),
      ...(release.description !== ''
        ? [
            {
              type: 'button',
              action_id: 'release-button-full-changelog-action',
              text: {
                type: 'plain_text',
                text: 'View Full Changelog',
                emoji: true,
              },
              value: injectActionsParameters(
                'release',
                release.projectId,
                release.tagName,
              ),
            },
          ]
        : []),
    ],
  } as KnownBlock;
}

const DEPLOYMENT_STATE_INFO: Record<string, { emoji: string; text: string }> = {
  deploying: { emoji: '⏳', text: 'Deployment started' },
  failed: { emoji: '❌', text: 'Deployment failed' },
  monitoring: { emoji: '🔍', text: 'Monitoring' },
  completed: { emoji: '✅', text: 'Deployed successfully' },
  default: { emoji: '❓', text: 'Unknown state' },
};

const getTimestamp = (date?: string): number | undefined => {
  return date ? Math.floor(new Date(date).getTime() / 1000) : undefined;
};

const formatDeploymentTimeInfo = (
  deploymentState: DeploymentState,
  startTime?: number,
  endTime?: number,
): string => {
  const formatSlackDate = (ts: number, format: string, fallback: string) =>
    `<!date^${ts}^${format}|${fallback}>`;

  if (deploymentState === 'deploying') {
    return startTime
      ? ` ${formatSlackDate(startTime, 'at {time} on {date_short_pretty}', 'now')}`
      : '';
  }

  const timeParts: string[] = [];
  if (startTime) {
    timeParts.push(
      `started ${formatSlackDate(startTime, 'at {time}', 'earlier')}`,
    );
  }

  if (endTime) {
    let endText = '';
    if (deploymentState === 'failed') {
      endText = `failed ${formatSlackDate(endTime, 'at {time}', 'now')}`;
    } else if (
      deploymentState === 'completed' ||
      deploymentState === 'monitoring'
    ) {
      endText = `finished ${formatSlackDate(endTime, 'at {time}', 'now')}`;
      if (startTime) {
        const durationSeconds = endTime - startTime;
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        endText += ` (*took ${minutes}m ${seconds}s*)`;
      }
    }
    if (endText) {
      timeParts.push(endText);
    }
  }

  return timeParts.length > 0 ? ` — ${timeParts.join(', ')}` : '';
};

function buildDeploymentBlock(
  release: DataRelease,
  releaseStateUpdates: ReleaseStateUpdate[],
): KnownBlock[] {
  const blocks: KnownBlock[] = [{ type: 'divider' }];

  const environmentStateMap = new Map<string, ReleaseStateUpdate>();
  for (const update of releaseStateUpdates) {
    environmentStateMap.set(update.environment, update);
  }

  const allEnvironments: ReleaseEnvironment[] = [
    'integration',
    'staging',
    'production',
    'support',
  ];

  for (const environment of allEnvironments) {
    // Get the state update if it exists, otherwise determine state from deployment arrays
    const update = environmentStateMap.get(environment);
    let deploymentState: DeploymentState;

    if (update) {
      deploymentState = update.deploymentState;
    } else {
      if (
        release.successfulDeployments.some((d) => d.environment === environment)
      ) {
        deploymentState = 'completed';
      } else if (
        release.failedDeployments.some((d) => d.environment === environment)
      ) {
        deploymentState = 'failed';
      } else if (
        release.startedDeployments.some((d) => d.environment === environment)
      ) {
        deploymentState = 'deploying';
      } else {
        continue;
      }
    }

    const environmentName = capitalizeFirstLetter(environment);
    const stateInfo =
      DEPLOYMENT_STATE_INFO[deploymentState] || DEPLOYMENT_STATE_INFO.default;

    const startTime = getTimestamp(
      release.startedDeployments.find((d) => d.environment === environment)
        ?.date,
    );

    let endTime: number | undefined;
    if (deploymentState === 'failed') {
      endTime = getTimestamp(
        release.failedDeployments.find((d) => d.environment === environment)
          ?.date,
      );
    } else if (
      deploymentState === 'completed' ||
      deploymentState === 'monitoring'
    ) {
      endTime = getTimestamp(
        release.successfulDeployments.find((d) => d.environment === environment)
          ?.date,
      );
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${stateInfo.emoji} *${environmentName}:* ${stateInfo.text}${formatDeploymentTimeInfo(deploymentState, startTime, endTime)}`,
        },
      ],
    });

    if (deploymentState === 'monitoring') {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `:mag: @${release.slackAuthor.name}, please verify the changes on ${environmentName} are correct.`,
          },
        ],
      });
      if (
        FINAL_RELEASE_ENVIRONMENTS.includes(environment as ReleaseEnvironment)
      ) {
        blocks.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              style: 'primary',
              action_id: 'release-button-end-action',
              value: injectActionsParameters(
                'release',
                release.projectId,
                release.tagName,
              ),
              text: {
                type: 'plain_text',
                text: 'Validate & End Release',
                emoji: true,
              },
            },
          ],
        });
      }
    }
  }

  return blocks;
}

function createChangelogSummary(rawChangelog: string): string {
  const allLines = rawChangelog
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const totalCount = allLines.length;

  if (totalCount === 0) {
    return '*Changes (0 total):*\nNo changes found in this release.';
  }

  const previewText = allLines
    .slice(0, CHANGELOG_SUMMARY_DISPLAY_COUNT)
    .join('\n>');

  let summary = `**Changes (${totalCount} total):**\n>${previewText}`;

  if (totalCount > CHANGELOG_SUMMARY_DISPLAY_COUNT) {
    const remainingCount = totalCount - CHANGELOG_SUMMARY_DISPLAY_COUNT;
    summary += `\n_... and ${remainingCount} more._`;
  }

  return slackifyMarkdown(summary);
}
