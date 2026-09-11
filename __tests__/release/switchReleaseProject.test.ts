import type {
  InputBlock,
  PlainTextInput,
  StaticSelect,
  ViewsUpdateArguments,
} from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import { semanticReleaseTagManager } from '@/release/commands/create/managers/semanticReleaseTagManager';
import { stableDateReleaseTagManager } from '@/release/commands/create/managers/stableDateReleaseTagManager';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { projectFixture } from '../__fixtures__/projectFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

jest.mock('@/changelog/utils/generateChangelog', () => ({
  generateChangelog: jest.fn(),
}));

jest.mock('@/release/utils/ConfigHelper', () => ({
  __esModule: true,
  default: {
    hasChannelReleaseConfigs: jest.fn(),
    getChannelProjectReleaseConfigs: jest.fn(),
    getProjectReleaseConfig: jest.fn(),
  },
}));

const channelId = 'C0XXXXXXXXX';

/** Sorted first: the modal sorts the options by path_with_namespace. */
const firstProject = projectFixture;
const secondProject = {
  ...projectFixture,
  id: 2222,
  path_with_namespace: 'zz-group/zz-project',
};

const firstProjectTags = [...Array(5)].map((_, i) => ({
  name: `stable-20200101-100${i}`,
}));
const secondProjectTags = [{ name: '1.2.3' }, { name: '1.2.2' }];

const firstProjectConfig = {
  notificationChannelIds: [],
  projectId: firstProject.id,
  releaseChannelId: channelId,
  releaseManager: {},
  releaseTagManager: stableDateReleaseTagManager,
} as unknown as ProjectReleaseConfig;

const secondProjectConfig = {
  notificationChannelIds: [],
  projectId: secondProject.id,
  releaseChannelId: channelId,
  releaseManager: {},
  releaseTagManager: semanticReleaseTagManager,
} as unknown as ProjectReleaseConfig;

function getUpdatedView(nthCall: number) {
  return (
    (slackBotWebClient.views.update as jest.Mock).mock.calls[nthCall - 1][0] as
      | ViewsUpdateArguments
      | undefined
  )?.view;
}

function findBlockByActionId(
  blocks: ViewsUpdateArguments['view']['blocks'],
  actionId: string,
) {
  return [...blocks].find(
    (block) =>
      ((block as InputBlock).element as StaticSelect | PlainTextInput)
        ?.action_id === actionId,
  ) as InputBlock | undefined;
}

async function postBlockActions(payload: Record<string, unknown>) {
  const body = { payload: JSON.stringify(payload) };

  return request(app)
    .post('/api/v1/homer/interactive')
    .set(getSlackHeaders(body))
    .send(body);
}

describe('release > switchReleaseProject', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    (ConfigHelper.hasChannelReleaseConfigs as jest.Mock).mockResolvedValue(
      true,
    );
    (
      ConfigHelper.getChannelProjectReleaseConfigs as jest.Mock
    ).mockResolvedValue([firstProjectConfig, secondProjectConfig]);
    (ConfigHelper.getProjectReleaseConfig as jest.Mock).mockImplementation(
      async (projectId: number) =>
        projectId === secondProject.id
          ? secondProjectConfig
          : firstProjectConfig,
    );
    (generateChangelog as jest.Mock).mockResolvedValue('');
    (slackBotWebClient.views.open as jest.Mock).mockResolvedValue({
      view: { id: 'viewId' },
    });

    mockGitlabCall(`/projects/${firstProject.id}`, firstProject);
    mockGitlabCall(`/projects/${secondProject.id}`, secondProject);
    mockGitlabCall(
      `/projects/${firstProject.id}/repository/tags?per_page=100`,
      firstProjectTags,
    );
    mockGitlabCall(
      `/projects/${secondProject.id}/repository/tags?per_page=100`,
      secondProjectTags,
    );
  });

  /** Opens the modal and returns the view displayed by Homer. */
  async function openReleaseModal() {
    const body = {
      channel_id: channelId,
      text: 'release',
      trigger_id: 'triggerId',
    };

    const response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);

    return getUpdatedView(1) as ViewsUpdateArguments['view'];
  }

  it('should display the tags of the first project when opening the modal', async () => {
    const view = await openReleaseModal();

    const projectBlock = findBlockByActionId(
      view.blocks,
      'release-select-project-action',
    );
    const releaseTagBlock = findBlockByActionId(
      view.blocks,
      'release-tag-action',
    );
    const previousTagBlock = findBlockByActionId(
      view.blocks,
      'release-select-previous-tag-action',
    );

    expect(
      (projectBlock?.element as StaticSelect).initial_option?.value,
    ).toEqual(`${firstProject.id}`);
    expect(releaseTagBlock?.block_id).toEqual(
      'release-tag-block-1148-stable-20200101-1000',
    );
    expect((releaseTagBlock?.element as PlainTextInput).initial_value).toEqual(
      'stable-19700101-0100',
    );
    expect(previousTagBlock?.block_id).toEqual(
      'release-previous-tag-block-1148',
    );
  });

  it('should refresh the release numbers when switching project', async () => {
    const view = await openReleaseModal();
    const projectBlock = findBlockByActionId(
      view.blocks,
      'release-select-project-action',
    ) as InputBlock;
    const projectOptions = (projectBlock.element as StaticSelect)
      .options as StaticSelect['options'];

    // When the second project is selected in the combo box
    const response = await postBlockActions({
      actions: [{ action_id: 'release-select-project-action' }],
      type: 'block_actions',
      view: {
        ...view,
        id: 'viewId',
        state: {
          values: {
            [projectBlock.block_id as string]: {
              'release-select-project-action': {
                selected_option: projectOptions?.[1],
              },
            },
            // Carried over from the first project, as Slack does.
            'release-previous-tag-block-1148': {
              'release-select-previous-tag-action': {
                selected_option: { value: 'stable-20200101-1000' },
              },
            },
          },
        },
      },
    });

    expect(response.status).toEqual(HTTP_STATUS_OK);

    // Then the rebuilt modal displays the second project's release numbers
    const updatedView = getUpdatedView(3) as ViewsUpdateArguments['view'];
    const releaseTagBlock = findBlockByActionId(
      updatedView.blocks,
      'release-tag-action',
    );
    const previousTagBlock = findBlockByActionId(
      updatedView.blocks,
      'release-select-previous-tag-action',
    );

    expect(
      (
        findBlockByActionId(updatedView.blocks, 'release-select-project-action')
          ?.element as StaticSelect
      ).initial_option?.value,
    ).toEqual(`${secondProject.id}`);

    expect((releaseTagBlock?.element as PlainTextInput).initial_value).toEqual(
      '1.2.4',
    );
    expect(
      (previousTagBlock?.element as StaticSelect).initial_option?.value,
    ).toEqual('1.2.3');
    expect(
      (previousTagBlock?.element as StaticSelect).options?.map(
        ({ value }) => value,
      ),
    ).toEqual(['1.2.3', '1.2.2']);

    // And the block ids rotated, so that Slack rebuilds the inputs instead of
    // preserving the values of the previously selected project.
    expect(releaseTagBlock?.block_id).toEqual('release-tag-block-2222-1.2.3');
    expect(previousTagBlock?.block_id).toEqual(
      'release-previous-tag-block-2222',
    );
    expect(
      updatedView.blocks.filter(({ block_id }) =>
        block_id?.includes(`${firstProject.id}`),
      ),
    ).toEqual([]);
  });

  it('should fall back to the latest tag whether the selected previous tag does not exist', async () => {
    const view = await openReleaseModal();
    const projectBlock = findBlockByActionId(
      view.blocks,
      'release-select-project-action',
    ) as InputBlock;
    const projectOptions = (projectBlock.element as StaticSelect)
      .options as StaticSelect['options'];

    // When the previous release tag of another project is kept in the state
    const response = await postBlockActions({
      actions: [{ action_id: 'release-select-previous-tag-action' }],
      type: 'block_actions',
      view: {
        ...view,
        id: 'viewId',
        state: {
          values: {
            [projectBlock.block_id as string]: {
              'release-select-project-action': {
                selected_option: projectOptions?.[1],
              },
            },
            'release-previous-tag-block-1148': {
              'release-select-previous-tag-action': {
                selected_option: { value: 'stable-20200101-1000' },
              },
            },
          },
        },
      },
    });

    expect(response.status).toEqual(HTTP_STATUS_OK);

    // Then the modal is rebuilt instead of being stuck on its loader
    const updatedView = getUpdatedView(3) as ViewsUpdateArguments['view'];
    const previousTagBlock = findBlockByActionId(
      updatedView.blocks,
      'release-select-previous-tag-action',
    );

    expect(logger.error).toHaveBeenCalledWith(
      new Error(
        `Previous release tag stable-20200101-1000 not found in project ${secondProject.id}`,
      ),
    );
    expect(
      (previousTagBlock?.element as StaticSelect).initial_option?.value,
    ).toEqual('1.2.3');
  });

  it('should fall back to the first project whether the selected one is not a number', async () => {
    const view = await openReleaseModal();
    const projectBlock = findBlockByActionId(
      view.blocks,
      'release-select-project-action',
    ) as InputBlock;

    // When Slack sends a project id Homer cannot parse
    const response = await postBlockActions({
      actions: [{ action_id: 'release-select-project-action' }],
      type: 'block_actions',
      view: {
        ...view,
        id: 'viewId',
        state: {
          values: {
            [projectBlock.block_id as string]: {
              'release-select-project-action': {
                selected_option: { value: 'not-a-number' },
              },
            },
          },
        },
      },
    });

    expect(response.status).toEqual(HTTP_STATUS_OK);

    // Then the modal is rebuilt on the first project instead of crashing
    const updatedView = getUpdatedView(3) as ViewsUpdateArguments['view'];

    expect(
      (
        findBlockByActionId(updatedView.blocks, 'release-select-project-action')
          ?.element as StaticSelect
      ).initial_option?.value,
    ).toEqual(`${firstProject.id}`);
    expect(
      findBlockByActionId(updatedView.blocks, 'release-tag-action')?.block_id,
    ).toEqual('release-tag-block-1148-stable-20200101-1000');
  });

  it('should log an unknown block action, reading the project from the view state', async () => {
    const view = await openReleaseModal();
    const projectBlock = findBlockByActionId(
      view.blocks,
      'release-select-project-action',
    ) as InputBlock;
    const projectOptions = (projectBlock.element as StaticSelect)
      .options as StaticSelect['options'];

    const response = await postBlockActions({
      actions: [{ action_id: 'release-unknown-action' }],
      type: 'block_actions',
      view: {
        ...view,
        id: 'viewId',
        state: {
          values: {
            [projectBlock.block_id as string]: {
              'release-select-project-action': {
                selected_option: projectOptions?.[1],
              },
            },
          },
        },
      },
    });

    expect(response.status).toEqual(HTTP_STATUS_OK);

    // The release config is looked up on the project selected in the state,
    // whatever the block it has been read from.
    expect(ConfigHelper.getProjectReleaseConfig).toHaveBeenCalledWith(
      secondProject.id,
    );
    expect(logger.error).toHaveBeenCalledWith(
      new Error('Unknown block action: release-unknown-action'),
    );
  });
});
