import type { SectionBlock, StaticSelect } from '@slack/web-api';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { createRelease } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import type { SlackUser } from '@/core/typings/SlackUser';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { pipelineFixture } from '@root/__tests__/__fixtures__/pipelineFixture';
import { projectFixture } from '@root/__tests__/__fixtures__/projectFixture';
import { releaseFixture } from '@root/__tests__/__fixtures__/releaseFixture';
import { fetch } from '@root/__tests__/utils/fetch';
import { getSlackHeaders } from '@root/__tests__/utils/getSlackHeaders';
import { mockGitlabCall } from '@root/__tests__/utils/mockGitlabCall';

describe('release > endRelease', () => {
  describe('default workflow', () => {
    it('should end a release in monitoring state', async () => {
      // Given
      const projectId = projectFixture.id;
      const releaseConfig = await ConfigHelper.getProjectReleaseConfig(
        projectId
      );
      const channelId = releaseConfig.releaseChannelId;
      const userId = 'userId';
      let body: any = {
        channel_id: channelId,
        text: 'release end',
        user_id: userId,
      };

      await createRelease({
        description: '',
        failedDeployments: [],
        projectId,
        slackAuthor: {
          id: 'slackUserId',
          profile: { image_72: 'image_72' },
          real_name: 'real_name',
        } as SlackUser,
        startedDeployments: ['int', 'staging', 'production'],
        state: 'monitoring',
        successfulDeployments: ['int', 'staging', 'production'],
        tagName: releaseFixture.tag_name,
      });

      mockGitlabCall(`/projects/${projectId}`, projectFixture);

      // When
      let response = await fetch('/api/v1/homer/command', {
        body,
        headers: getSlackHeaders(body),
      });

      // Then
      expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          blocks: expect.any(Array),
          channel: channelId,
          user: userId,
        })
      );

      const block = (slackBotWebClient.chat.postEphemeral as jest.Mock).mock
        .calls[0][0].blocks[0] as SectionBlock | undefined;

      expect(block?.text?.text).toContain('Choose a release to end:');
      expect(
        (block?.accessory as StaticSelect | undefined)?.option_groups
      ).toHaveLength(1);

      // Given
      const { action_id, option_groups } = block?.accessory as StaticSelect;
      const responseUrl = 'https://slack/responseUrl';
      body = {
        payload: JSON.stringify({
          actions: [
            {
              action_id,
              selected_option: { value: option_groups?.[0].options?.[0].value },
            },
          ],
          container: { channel_id: channelId },
          response_url: responseUrl,
          type: 'block_actions',
          user: { id: userId },
        }),
      };
      const { mockUrl } = (await import('node-fetch')) as any;
      mockUrl(responseUrl, { json: Promise.resolve('') });

      mockGitlabCall(
        `/projects/${projectId}/pipelines?ref=${releaseFixture.tag_name}`,
        [pipelineFixture]
      );

      // When
      response = await fetch('/api/v1/homer/interactive', {
        body,
        headers: getSlackHeaders(body),
      });

      // Then
      expect(response.status).toEqual(HTTP_STATUS_OK);
      expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
      releaseConfig.notificationChannelIds.forEach(
        (notificationChannelId, index) => {
          expect(slackBotWebClient.chat.postMessage).toHaveBeenNthCalledWith(
            index + 1,
            {
              blocks: [
                {
                  text: {
                    text: `:ccheck: ${projectFixture.path} PRD - <${pipelineFixture.web_url}|pipeline> - <${projectFixture.web_url}/-/releases/${releaseFixture.tag_name}|release notes>`,
                    type: 'mrkdwn',
                  },
                  type: 'section',
                },
              ],
              channel: notificationChannelId,
              icon_url: 'image_72',
              link_names: true,
              text: ':ccheck: diaspora-project-site PRD',
              username: 'real_name',
            }
          );
        }
      );
      const { hasModelEntry } = (await import('sequelize')) as any;
      expect(
        await hasModelEntry('Release', { tagName: releaseFixture.tag_name })
      ).toEqual(false);
    });
  });
});
