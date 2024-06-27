import type { ChatPostMessageArguments } from '@slack/web-api';
import type { SlackUser } from '@/core/typings/SlackUser';
import type { ReleaseStateUpdate } from '../../../typings/ReleaseStateUpdate';

interface ReleaseMessageData {
  channelId: string;
  pipelineUrl: string;
  projectPathWithNamespace: string;
  projectWebUrl: string;
  releaseCreator: SlackUser;
  releaseStateUpdates: ReleaseStateUpdate[];
  releaseTagName: string;
}

export function buildReleaseStateMessage({
  channelId,
  pipelineUrl,
  projectPathWithNamespace,
  projectWebUrl,
  releaseCreator,
  releaseStateUpdates,
  releaseTagName,
}: ReleaseMessageData): ChatPostMessageArguments {
  const blocks = releaseStateUpdates.map(
    ({
      deploymentState,
      environment,
      projectDisplayName = projectPathWithNamespace.split('/').pop(),
    }) => {
      let emoji = '';
      let formattedEnvironment = '';

      switch (deploymentState) {
        case 'deploying':
          emoji = ':rocket:';
          break;

        case 'failed':
          emoji = ':rocket-boom:';
          break;

        case 'monitoring':
          emoji = ':mag:';
          break;

        case 'completed':
          emoji = ':ccheck:';
          break;

        default:
          throw new Error(`Unknown deployment state: ${deploymentState}`);
      }

      switch (environment) {
        case 'integration':
          formattedEnvironment = 'INT';
          break;

        case 'production':
          formattedEnvironment = 'PRD';
          break;

        case 'staging':
          formattedEnvironment = 'STG';
          break;

        case 'support':
          formattedEnvironment = 'SUP';
          break;

        default:
          throw new Error(`Unknown environment: ${environment}`);
      }

      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} ${projectDisplayName} ${formattedEnvironment} - <${pipelineUrl}|pipeline> - <${projectWebUrl}/-/releases/${releaseTagName}|release notes>`,
        },
      };
    }
  );

  return {
    channel: channelId,
    blocks,
    icon_url: releaseCreator.profile.image_72,
    link_names: true,
    text: blocks.map((block) => block.text.text.split(' - ')[0]).join('\n'),
    username: releaseCreator.real_name,
  };
}
