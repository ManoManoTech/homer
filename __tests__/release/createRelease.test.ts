import type {
  InputBlock,
  PlainTextInput,
  StaticSelect,
  ViewsOpenArguments,
} from '@slack/web-api';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { dockerBuildJobFixture } from '../__fixtures__/dockerBuildJobFixture';
import { jobFixture } from '../__fixtures__/jobFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { pipelineFixture } from '../__fixtures__/pipelineFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import { releaseFixture } from '../__fixtures__/releaseFixture';
import { tagFixture } from '../__fixtures__/tagFixture';
import { fetch } from '../utils/fetch';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';
import { waitFor } from '../utils/waitFor';

describe('release > createRelease', () => {
  let releaseConfig: ProjectReleaseConfig;
  beforeAll(async () => {
    releaseConfig = await ConfigHelper.getProjectReleaseConfig(
      projectFixture.id
    );
  });

  it('should create a release whereas main pipeline is ready', async () => {
    /** Step 1: display release modal */

    // Given
    const { projectId } = releaseConfig;
    const releaseTagName = 'stable-19700101-0100';
    let body: Record<string, unknown> = {
      channel_id: releaseConfig.releaseChannelId,
      text: 'release',
      trigger_id: 'triggerId',
    };

    jest.useFakeTimers();
    jest.setSystemTime(0);
    mockGitlabCall(`/projects/${projectId}`, projectFixture);
    mockGitlabCall(
      `/projects/${projectId}/repository/tags?per_page=100`,
      [...Array(10)].map((_, i) => ({
        tagFixture,
        name: `${tagFixture.name.slice(0, -1)}${i}`,
      }))
    );
    mockGitlabCall(
      `/projects/${projectId}/repository/tags/${tagFixture.name}`,
      tagFixture
    );
    mockGitlabCall(
      `/projects/${projectId}/repository/commits?since=2017-07-26T09:08:54.000Z&per_page=100`,
      [
        {
          id: 'ed899a2f4b50b4370feeea94676502b42383c746',
          title: "Merge branch 'branch-name' into 'master'",
          message: `\
      Merge branch 'branch-name' into 'master'

      chore(test): replace sanitize with escape once

      See merge request ${projectFixture.path_with_namespace}!${mergeRequestFixture.iid}`,
        },
        {
          id: '6104942438c14ec7bd21c6cd5bd995272b3faff6',
          title: 'Sanitize for network graph',
          message: 'Sanitize for network graph',
        },
      ]
    );
    mockGitlabCall(
      `/projects/${projectId}/merge_requests/${mergeRequestFixture.iid}`,
      mergeRequestFixture
    );
    mockGitlabCall(
      `/projects/${projectId}/merge_requests/${mergeRequestFixture.iid}/commits?per_page=100`,
      [
        {
          message: 'feat(great): implement great feature\n\nJIRA: SPAR-156',
          title: 'feat(great): implement great feature',
        },
        {
          message:
            'feat(great): implement another great feature\n\nJIRA: SPAR-158',
          title: 'feat(great): implement another great feature',
        },
      ]
    );

    // When
    let response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.views.open).toHaveBeenNthCalledWith(1, {
      trigger_id: 'triggerId',
      view: {
        type: 'modal',
        callback_id: 'release-create-modal',
        title: {
          type: 'plain_text',
          text: 'Release',
        },
        submit: {
          type: 'plain_text',
          text: 'Start',
        },
        notify_on_close: false,
        blocks: [
          {
            type: 'input',
            block_id: 'release-project-block',
            dispatch_action: true,
            element: {
              type: 'static_select',
              action_id: 'release-select-project-action',
              initial_option: {
                text: {
                  text: projectFixture.path_with_namespace,
                  type: 'plain_text',
                },
                value: `${projectFixture.id}`,
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: projectFixture.path_with_namespace,
                  },
                  value: `${projectFixture.id}`,
                },
              ],
              placeholder: {
                type: 'plain_text',
                text: 'Select the project',
              },
            },
            label: {
              type: 'plain_text',
              text: 'Project',
            },
          },
          {
            block_id: 'release-tag-block',
            element: {
              action_id: 'release-tag-action',
              initial_value: 'stable-19700101-0100',
              type: 'plain_text_input',
            },
            label: {
              text: 'Release tag',
              type: 'plain_text',
            },
            type: 'input',
          },
          {
            block_id: 'release-previous-tag-block',
            dispatch_action: true,
            element: {
              action_id: 'release-select-previous-tag-action',
              initial_option: {
                text: {
                  text: 'stable-20200101-1000',
                  type: 'plain_text',
                },
                value: 'stable-20200101-1000',
              },
              options: [
                {
                  text: {
                    text: 'stable-20200101-1000',
                    type: 'plain_text',
                  },
                  value: 'stable-20200101-1000',
                },
                {
                  text: {
                    text: 'stable-20200101-1001',
                    type: 'plain_text',
                  },
                  value: 'stable-20200101-1001',
                },
                {
                  text: {
                    text: 'stable-20200101-1002',
                    type: 'plain_text',
                  },
                  value: 'stable-20200101-1002',
                },
                {
                  text: {
                    text: 'stable-20200101-1003',
                    type: 'plain_text',
                  },
                  value: 'stable-20200101-1003',
                },
                {
                  text: {
                    text: 'stable-20200101-1004',
                    type: 'plain_text',
                  },
                  value: 'stable-20200101-1004',
                },
              ],
              placeholder: {
                text: 'Select the previous release tag',
                type: 'plain_text',
              },
              type: 'static_select',
            },
            label: {
              text: 'Previous release tag',
              type: 'plain_text',
            },
            type: 'input',
          },
          {
            block_id: 'release-previous-tag-info-block',
            elements: [
              {
                text: 'This should be changed only whether the previous release has been aborted.',
                type: 'plain_text',
              },
            ],
            type: 'context',
          },
          {
            text: {
              text: '*Changelog*',
              type: 'mrkdwn',
            },
            type: 'section',
          },
          {
            block_id: 'release-changelog-block',
            text: {
              text: '•   <http://gitlab.example.com/my-group/my-project/merge_requests/1|feat(great): implement great feature> - <https://my-ticket-management.com/view/SPAR-156|SPAR-156>\n•   <http://gitlab.example.com/my-group/my-project/merge_requests/1|feat(great): implement another great feature> - <https://my-ticket-management.com/view/SPAR-158|SPAR-158>\n',
              type: 'mrkdwn',
            },
            type: 'section',
          },
        ],
      },
    });

    /** Step 2: select project */

    // Given
    let { view } = (slackBotWebClient.views.open as jest.Mock).mock
      .calls[0][0] as ViewsOpenArguments;

    const selectProjectBlock = [...view.blocks].find(
      (block) => block.block_id === 'release-project-block'
    ) as InputBlock;
    const selectProjectElement = selectProjectBlock.element as StaticSelect;

    body = {
      payload: JSON.stringify({
        actions: [{ action_id: selectProjectElement.action_id }],
        type: 'block_actions',
        view: {
          ...view,
          id: 'viewId',
          state: {
            values: {
              [selectProjectBlock.block_id as string]: {
                [selectProjectElement.action_id as string]: {
                  selected_option: selectProjectElement.options?.[0],
                },
              },
            },
          },
        },
      }),
    };

    // When
    response = await fetch('/api/v1/homer/interactive', {
      body,
      headers: getSlackHeaders(body),
    });

    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.views.update).toHaveBeenNthCalledWith(1, {
      view: {
        ...view,
        blocks: [
          ...view.blocks.slice(0, 1),
          {
            type: 'section',
            text: {
              type: 'plain_text',
              text: ':loader:',
            },
          },
        ],
      },
      view_id: 'viewId',
    });
    expect(slackBotWebClient.views.update).toHaveBeenNthCalledWith(2, {
      view: {
        blocks: [
          {
            type: 'input',
            block_id: 'release-project-block',
            dispatch_action: true,
            element: {
              type: 'static_select',
              action_id: 'release-select-project-action',
              initial_option: {
                text: {
                  text: projectFixture.path_with_namespace,
                  type: 'plain_text',
                },
                value: `${projectFixture.id}`,
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: projectFixture.path_with_namespace,
                  },
                  value: `${projectFixture.id}`,
                },
              ],
              placeholder: {
                type: 'plain_text',
                text: 'Select the project',
              },
            },
            label: {
              type: 'plain_text',
              text: 'Project',
            },
          },
          {
            block_id: 'release-tag-block',
            element: {
              action_id: 'release-tag-action',
              initial_value: releaseTagName,
              type: 'plain_text_input',
            },
            label: { text: 'Release tag', type: 'plain_text' },
            type: 'input',
          },
          {
            block_id: 'release-previous-tag-block',
            dispatch_action: true,
            element: {
              action_id: 'release-select-previous-tag-action',
              initial_option: {
                text: { text: 'stable-20200101-1000', type: 'plain_text' },
                value: 'stable-20200101-1000',
              },
              options: [
                {
                  text: { text: 'stable-20200101-1000', type: 'plain_text' },
                  value: 'stable-20200101-1000',
                },
                {
                  text: { text: 'stable-20200101-1001', type: 'plain_text' },
                  value: 'stable-20200101-1001',
                },
                {
                  text: { text: 'stable-20200101-1002', type: 'plain_text' },
                  value: 'stable-20200101-1002',
                },
                {
                  text: { text: 'stable-20200101-1003', type: 'plain_text' },
                  value: 'stable-20200101-1003',
                },
                {
                  text: { text: 'stable-20200101-1004', type: 'plain_text' },
                  value: 'stable-20200101-1004',
                },
              ],
              placeholder: {
                text: 'Select the previous release tag',
                type: 'plain_text',
              },
              type: 'static_select',
            },
            label: { text: 'Previous release tag', type: 'plain_text' },
            type: 'input',
          },
          {
            block_id: 'release-previous-tag-info-block',
            elements: [
              {
                text: 'This should be changed only whether the previous release has been aborted.',
                type: 'plain_text',
              },
            ],
            type: 'context',
          },
          { text: { text: '*Changelog*', type: 'mrkdwn' }, type: 'section' },
          {
            block_id: 'release-changelog-block',
            text: {
              text: '•   <http://gitlab.example.com/my-group/my-project/merge_requests/1|feat(great): implement great feature> - <https://my-ticket-management.com/view/SPAR-156|SPAR-156>\n•   <http://gitlab.example.com/my-group/my-project/merge_requests/1|feat(great): implement another great feature> - <https://my-ticket-management.com/view/SPAR-158|SPAR-158>\n',
              type: 'mrkdwn',
            },
            type: 'section',
          },
        ],
        callback_id: 'release-create-modal',
        notify_on_close: false,
        submit: { text: 'Start', type: 'plain_text' },
        title: { text: 'Release', type: 'plain_text' },
        type: 'modal',
      },
      view_id: 'viewId',
    });

    /** Step 3: select previous release tag */

    // Given
    ({ view } = (slackBotWebClient.views.update as jest.Mock).mock
      .calls[1][0] as ViewsOpenArguments);

    const previousTagBlock = [...view.blocks].find(
      (block) => block.block_id === 'release-previous-tag-block'
    ) as InputBlock;
    const previousTagElement = previousTagBlock.element as StaticSelect;

    body = {
      payload: JSON.stringify({
        actions: [{ action_id: previousTagElement.action_id }],
        type: 'block_actions',
        view: {
          ...view,
          id: 'viewId',
          state: {
            values: {
              [selectProjectBlock.block_id as string]: {
                [selectProjectElement.action_id as string]: {
                  selected_option: selectProjectElement.options?.[0],
                },
              },
              [previousTagBlock.block_id as string]: {
                [previousTagElement.action_id as string]: {
                  selected_option: previousTagElement.options?.[0],
                },
              },
            },
          },
        },
      }),
    };

    // When
    response = await fetch('/api/v1/homer/interactive', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(slackBotWebClient.views.update).toHaveBeenNthCalledWith(3, {
      view: {
        ...view,
        blocks: [
          ...view.blocks.slice(0, -2),
          {
            type: 'section',
            text: {
              type: 'plain_text',
              text: ':loader:',
            },
          },
        ],
      },
      view_id: 'viewId',
    });
    expect(slackBotWebClient.views.update).toHaveBeenNthCalledWith(4, {
      view,
      view_id: 'viewId',
    });

    /** Step 4: create release */

    // Given
    const releaseTagBlock = [...view.blocks].find(
      (block) => block.block_id === 'release-tag-block'
    ) as InputBlock;
    const releaseTagElement = releaseTagBlock.element as PlainTextInput;

    body = {
      payload: JSON.stringify({
        type: 'view_submission',
        user: { id: 'userId' },
        view: {
          ...view,
          state: {
            values: {
              [selectProjectBlock.block_id as string]: {
                [selectProjectElement.action_id as string]: {
                  selected_option: selectProjectElement.options?.[0],
                },
              },
              [releaseTagBlock.block_id as string]: {
                [releaseTagElement.action_id as string]: {
                  value: releaseTagElement.initial_value,
                },
              },
              [previousTagBlock.block_id as string]: {
                [previousTagElement.action_id as string]: {
                  selected_option: previousTagElement.options?.[0],
                },
              },
            },
          },
        },
      }),
    };

    (slackBotWebClient.users.info as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        user: {
          id: 'slackUserId',
          profile: { image_72: 'image_72' },
          real_name: 'real_name',
        },
      })
    );

    const releaseCallMock = mockGitlabCall(
      `/projects/${projectId}/releases`,
      releaseFixture
    );
    mockGitlabCall(`/projects/${projectId}/pipelines?ref=master`, [
      pipelineFixture,
    ]);
    mockGitlabCall(
      `/projects/${projectId}/pipelines/${pipelineFixture.id}/jobs?per_page=100`,
      [dockerBuildJobFixture, jobFixture]
    );
    mockGitlabCall(
      `/projects/${projectId}/pipelines?ref=${releaseTagName}`,
      []
    );

    // When
    response = await fetch('/api/v1/homer/interactive', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(
      await hasModelEntry('Release', {
        slackAuthor:
          '{"id":"slackUserId","profile":{"image_72":"image_72"},"real_name":"real_name"}',
        tagName: releaseTagName,
      })
    ).toEqual(true);
    expect(releaseCallMock.called).toEqual(true);
    expect(releaseCallMock.calledWith?.[1]).toEqual({
      body: `{"description":"- [feat(great): implement great feature](http://gitlab.example.com/my-group/my-project/merge_requests/1) - [SPAR-156](https://my-ticket-management.com/view/SPAR-156)\\n- [feat(great): implement another great feature](http://gitlab.example.com/my-group/my-project/merge_requests/1) - [SPAR-158](https://my-ticket-management.com/view/SPAR-158)","tag_name":"${releaseTagName}","ref":"${pipelineFixture.sha}"}`,
      headers: { 'Content-Type': 'application/json' },
      method: 'post',
    });
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: releaseConfig.releaseChannelId,
      text: `Release \`${releaseTagName}\` started for \`${projectFixture.path}\` :homer-happy:`,
      user: 'slackUserId',
    });

    /** Step 5: post message with release pipeline and changelog */

    // Given
    mockGitlabCall(`/projects/${projectId}/pipelines?ref=${releaseTagName}`, [
      pipelineFixture,
    ]);

    // When
    jest.advanceTimersByTime(2000);
    jest.useRealTimers();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    }); // execute pending tasks in the event loop

    // Then
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(2);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(2, {
      channel: releaseConfig.releaseChannelId,
      text: `↳ <${pipelineFixture.web_url}|pipeline> :homer-donut:`,
      user: 'slackUserId',
    });
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackBotWebClient.chat.postMessage).toHaveBeenCalledWith({
      channel: releaseConfig.releaseChannelId,
      blocks: [
        {
          text: {
            text: `\
:homer: New release <${projectFixture.web_url}/-/releases/stable-19700101-0100|${releaseTagName}> for project <${projectFixture.web_url}|${projectFixture.path_with_namespace}>:
  •   <http://gitlab.example.com/my-group/my-project/merge_requests/1|feat(great): implement great feature> - <https://my-ticket-management.com/view/SPAR-156|SPAR-156>
  •   <http://gitlab.example.com/my-group/my-project/merge_requests/1|feat(great): implement another great feature> - <https://my-ticket-management.com/view/SPAR-158|SPAR-158>`,
            type: 'mrkdwn',
          },
          type: 'section',
        },
      ],
      icon_url: 'image_72',
      text: `New release ${releaseTagName} for project ${projectFixture.path_with_namespace}.`,
      username: 'real_name',
    });
  });

  it('should create a release whereas main pipeline is not yet ready', async () => {
    /** Step 1: submit the release modal (full workflow tested above) */

    // Given
    const { projectId } = releaseConfig;
    const releaseTagName = 'stable-20200101-1100';
    const userId = 'slackUserId';
    const body = {
      payload: JSON.stringify({
        type: 'view_submission',
        user: { id: userId },
        view: {
          callback_id: 'release-create-modal',
          state: {
            values: {
              'release-project-block': {
                'release-select-project-action': {
                  selected_option: {
                    value: releaseConfig.projectId.toString(),
                  },
                },
              },
              'release-previous-tag-block': {
                'release-select-previous-tag-action': {
                  selected_option: {
                    value: 'stable-20200101-1000',
                  },
                },
              },
              'release-tag-block': {
                'release-tag-action': {
                  value: releaseTagName,
                },
              },
            },
          },
        },
      }),
    };

    jest.useFakeTimers();

    (slackBotWebClient.users.info as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        user: {
          id: 'slackUserId',
          profile: { image_72: 'image_72' },
          real_name: 'real_name',
        },
      })
    );

    mockGitlabCall(`/projects/${projectId}/releases`, releaseFixture);
    mockGitlabCall(`/projects/${projectId}/pipelines?ref=master`, [
      pipelineFixture,
    ]);
    mockGitlabCall(
      `/projects/${projectId}/pipelines/${pipelineFixture.id}/jobs?per_page=100`,
      [{ ...dockerBuildJobFixture, status: 'running' }]
    );
    mockGitlabCall(
      `/projects/${projectId}/repository/tags/${tagFixture.name}`,
      tagFixture
    );
    mockGitlabCall(
      `/projects/${projectId}/repository/commits?since=2017-07-26T09:08:54.000Z&per_page=100`,
      [
        {
          id: 'ed899a2f4b50b4370feeea94676502b42383c746',
          title: "Merge branch 'branch-name' into 'master'",
          message: `\
      Merge branch 'branch-name' into 'master'

      chore(test): replace sanitize with escape once

      See merge request ${projectFixture.path_with_namespace}!${mergeRequestFixture.iid}`,
        },
        {
          id: '6104942438c14ec7bd21c6cd5bd995272b3faff6',
          title: 'Sanitize for network graph',
          message: 'Sanitize for network graph',
        },
      ]
    );
    mockGitlabCall(
      `/projects/${projectId}/merge_requests/${mergeRequestFixture.iid}`,
      mergeRequestFixture
    );
    mockGitlabCall(
      `/projects/${projectId}/merge_requests/${mergeRequestFixture.iid}/commits?per_page=100`,
      [
        {
          message: 'feat(great): implement great feature\n\nJIRA: SPAR-156',
          title: 'feat(great): implement great feature',
        },
        {
          message:
            'feat(great): implement another great feature\n\nJIRA: SPAR-158',
          title: 'feat(great): implement another great feature',
        },
      ]
    );
    mockGitlabCall(`/projects/${projectId}`, projectFixture);

    // When
    const response = await fetch('/api/v1/homer/interactive', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
    expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(1, {
      channel: releaseConfig.releaseChannelId,
      text: `The preconditions to launch a release are not yet met, I will \
wait for them and start the release automatically (<${pipelineFixture.web_url}|pipeline>) :homer-donut:`,
      user: userId,
    });

    /** Step 2: pipelines becomes ready and release starts */

    // Given
    const releaseCallMock = mockGitlabCall(
      `/projects/${projectId}/releases`,
      releaseFixture
    );
    mockGitlabCall(
      `/projects/${projectId}/pipelines/${pipelineFixture.id}/jobs?per_page=100`,
      [dockerBuildJobFixture, jobFixture]
    );
    mockGitlabCall(`/projects/${projectId}/pipelines?ref=${releaseTagName}`, [
      pipelineFixture,
    ]);

    // When
    jest.advanceTimersByTime(30000);
    jest.useRealTimers();

    // Then
    await waitFor(() => {
      expect(releaseCallMock.called).toEqual(true);
      expect(releaseCallMock.calledWith?.[1]).toEqual({
        body: `{"description":"- [feat(great): implement great feature](http://gitlab.example.com/my-group/my-project/merge_requests/1) - [SPAR-156](https://my-ticket-management.com/view/SPAR-156)\\n- [feat(great): implement another great feature](http://gitlab.example.com/my-group/my-project/merge_requests/1) - [SPAR-158](https://my-ticket-management.com/view/SPAR-158)","tag_name":"${releaseTagName}","ref":"${pipelineFixture.sha}"}`,
        headers: { 'Content-Type': 'application/json' },
        method: 'post',
      });
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenCalledTimes(3);
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(2, {
        channel: releaseConfig.releaseChannelId,
        text: `Release \`${releaseTagName}\` started for \`${projectFixture.path}\` :homer-happy:`,
        user: 'slackUserId',
      });
      expect(slackBotWebClient.chat.postEphemeral).toHaveBeenNthCalledWith(3, {
        channel: releaseConfig.releaseChannelId,
        text: `↳ <${pipelineFixture.web_url}|pipeline> :homer-donut:`,
        user: 'slackUserId',
      });
    });
  });

  it('should answer with an error message if command was not launched on the right channel', async () => {
    // Given
    const body = {
      channel_id: 'channelId',
      text: 'release',
      trigger_id: 'triggerId',
    };

    // When
    const response = await fetch('/api/v1/homer/command', {
      body,
      headers: getSlackHeaders(body),
    });

    // Then
    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(await response.text()).toMatch(
      'The release command cannot be used in this channel because it has not been set up (or not correctly) in the config file, please follow the <https://github.com/ManoManoTech/homer/#configure-homer-to-release-a-gitlab-project|corresponding documentation> :homer-donut:'
    );
  });
});
