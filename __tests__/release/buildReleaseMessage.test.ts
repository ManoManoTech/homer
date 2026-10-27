import type { ActionsBlock, KnownBlock } from '@slack/web-api';
import type { DataRelease } from '@/core/typings/Data';
import { buildReleaseMessage } from '@/release/commands/create/viewBuilders/buildReleaseMessage';
import type {
  DeploymentState,
  ReleaseEnvironment,
} from '@/release/typings/ReleaseStateUpdate';
import { projectFixture } from '../__fixtures__/projectFixture';
import { slackUserFixture } from '../__fixtures__/slackUserFixture';

function buildRelease(state: DataRelease['state']): DataRelease {
  return {
    description: 'Super nice release',
    failedDeployments: [],
    projectId: projectFixture.id,
    slackAuthor: slackUserFixture,
    startedDeployments: [],
    state,
    successfulDeployments: [],
    tagName: 'stable-19700101-0100',
  };
}

function getActionIds(
  state: DataRelease['state'],
  environment: ReleaseEnvironment,
  deploymentState: DeploymentState,
): string[] {
  const message = buildReleaseMessage({
    releaseChannelId: 'channelId',
    release: buildRelease(state),
    releaseStateUpdates: [{ deploymentState, environment }],
    project: projectFixture,
  });
  const { blocks } = message as { blocks: KnownBlock[] };
  // The first actions block holds the changelog button; the deployment buttons
  // (cancel / end) are in the last block, and only when there are any.
  const deploymentActionIds = blocks
    .filter((block): block is ActionsBlock => block.type === 'actions')
    .flatMap((block) =>
      block.elements.map(
        (element) => (element as { action_id: string }).action_id,
      ),
    );
  return deploymentActionIds.filter(
    (id) => id !== 'release-button-full-changelog-action',
  );
}

describe('release > buildReleaseMessage > action buttons', () => {
  it('offers Cancel while a production deployment is running', () => {
    expect(getActionIds('created', 'production', 'deploying')).toEqual([
      'release-button-cancel-action',
    ]);
  });

  it('offers Cancel and End while production is monitored', () => {
    expect(getActionIds('created', 'production', 'monitoring')).toEqual([
      'release-button-cancel-action',
      'release-button-end-action',
    ]);
  });

  it('offers no button once production is completed', () => {
    expect(getActionIds('monitoring', 'production', 'completed')).toEqual([]);
  });

  it('offers no button once support is completed, even if the release never reached monitoring', () => {
    expect(getActionIds('created', 'support', 'completed')).toEqual([]);
  });
});
