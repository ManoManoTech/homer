import type {
  InputBlock,
  PlainTextInput,
  StaticSelect,
  View,
} from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabTag } from '@/core/typings/GitlabTag';
import { dockerBuildJobFixture } from '../__fixtures__/dockerBuildJobFixture';
import { jobFixture } from '../__fixtures__/jobFixture';
import { pipelineFixture } from '../__fixtures__/pipelineFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import { releaseFixture } from '../__fixtures__/releaseFixture';
import { slackUserFixture } from '../__fixtures__/slackUserFixture';
import { tagFixture } from '../__fixtures__/tagFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';
import { waitFor } from '../utils/waitFor';

const CHANNEL_ID = 'C0XXXXXXXXX';

// Two projects sharing one release channel. ban-offer-history sorts first by
// path so it is the modal's default project.
const banOfferHistory = {
  id: 16271,
  path: 'deliver/product-delivery/ban-offer-history',
  tags: ['stable-20260828-1118', 'stable-20260819-1429'],
};
const deliveryConfiguration = {
  id: 5050,
  path: 'deliver/product-delivery/ms.delivery-configuration.manomano.com',
  tags: ['stable-20260902-1531', 'stable-20260901-1635'],
};

jest.mock('@root/config/homer/projects.json', () => ({
  projects: [
    {
      description: 'ms.delivery-configuration',
      notificationChannelIds: ['C0XXXXXXXXX'],
      projectId: 5050,
      releaseChannelId: 'C0XXXXXXXXX',
      releaseManager: 'defaultReleaseManager',
      releaseTagManager: 'stableDateReleaseTagManager',
    },
    {
      description: 'ban-offer-history',
      notificationChannelIds: ['C0XXXXXXXXX'],
      projectId: 16271,
      releaseChannelId: 'C0XXXXXXXXX',
      releaseManager: 'defaultReleaseManager',
      releaseTagManager: 'stableDateReleaseTagManager',
    },
  ],
}));

function buildTag(name: string): GitlabTag {
  return {
    ...tagFixture,
    name,
    commit: { ...tagFixture.commit, created_at: '2026-08-28T10:28:00.000Z' },
  };
}

function mockProject({ id, path, tags }: typeof banOfferHistory) {
  mockGitlabCall(`/projects/${id}`, {
    ...projectFixture,
    id,
    path_with_namespace: path,
  });
  mockGitlabCall(
    `/projects/${id}/repository/tags?per_page=100`,
    tags.map(buildTag),
  );
  tags.forEach((name) =>
    mockGitlabCall(`/projects/${id}/repository/tags/${name}`, buildTag(name)),
  );
  mockGitlabCall(
    `/projects/${id}/repository/commits?since=2026-08-28T10:28:01.000Z&per_page=100`,
    [],
  );
}

function findSelect(view: View, blockId: string) {
  const block = view.blocks.find((b) => b.block_id === blockId) as InputBlock;
  return { block, element: block.element as StaticSelect };
}

function findPreviousTagSelect(view: View) {
  const block = view.blocks.find(({ block_id }) =>
    (block_id as string).startsWith('release-previous-tag-block'),
  ) as InputBlock;
  return { block, element: block.element as StaticSelect };
}

function findTextInput(view: View, blockId: string) {
  const block = view.blocks.find((b) => b.block_id === blockId) as InputBlock;
  return block.element as PlainTextInput;
}

function loggedErrorMessages(): string[] {
  return (logger.error as jest.Mock).mock.calls
    .flat()
    .map((arg) => (arg instanceof Error ? arg.message : String(arg)));
}

describe('release > createRelease when switching project in the modal', () => {
  it('creates the release with a tag of the selected project when Slack keeps the previous-tag select state', async () => {
    mockProject(banOfferHistory);
    mockProject(deliveryConfiguration);
    // GitLab answers a JSON 404 body: ban-offer-history's tag does not exist
    // in ms.delivery-configuration. callAPI ignores the HTTP status.
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/repository/tags/${banOfferHistory.tags[0]}`,
      { message: '404 Tag Not Found' },
    );
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/pipelines?ref=master`,
      [pipelineFixture],
    );
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/pipelines/${pipelineFixture.id}/jobs?per_page=100`,
      [dockerBuildJobFixture, jobFixture],
    );
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/releases`,
      releaseFixture,
    );
    (slackBotWebClient.views.open as jest.Mock).mockResolvedValue({
      view: { id: 'viewId' },
    });
    (slackBotWebClient.users.info as jest.Mock).mockResolvedValue({
      user: slackUserFixture,
    });
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });

    /** Step 1: /homer release opens the modal on the first project */
    let body: Record<string, unknown> = {
      channel_id: CHANNEL_ID,
      text: 'release',
      trigger_id: 'triggerId',
    };
    let response = await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);

    const initialView = (slackBotWebClient.views.update as jest.Mock).mock
      .calls[0][0].view as View;
    const initialProject = findSelect(initialView, 'release-project-block');
    const initialPreviousTag = findPreviousTagSelect(initialView);
    const releaseTagName = findTextInput(initialView, 'release-tag-block')
      .initial_value as string;

    expect(initialProject.element.initial_option?.value).toEqual(
      `${banOfferHistory.id}`,
    );
    expect(initialPreviousTag.element.initial_option?.value).toEqual(
      banOfferHistory.tags[0],
    );
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/pipelines?ref=${releaseTagName}`,
      [pipelineFixture],
    );

    /** Step 2: the user switches to ms.delivery-configuration */
    const switchedProjectOption = initialProject.element.options?.find(
      (option) => option.value === `${deliveryConfiguration.id}`,
    );
    const stateAfterSwitch = {
      'release-project-block': {
        'release-select-project-action': {
          selected_option: switchedProjectOption,
        },
      },
      'release-tag-block': {
        'release-tag-action': { value: releaseTagName },
      },
      [`release-previous-tag-block-${banOfferHistory.id}`]: {
        'release-select-previous-tag-action': {
          selected_option: initialPreviousTag.element.initial_option,
        },
      },
    };
    body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [{ action_id: 'release-select-project-action' }],
        view: {
          ...initialView,
          id: 'viewId',
          state: { values: stateAfterSwitch },
        },
      }),
    };
    response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);
    expect(response.status).toEqual(HTTP_STATUS_OK);

    const rebuiltView = (slackBotWebClient.views.update as jest.Mock).mock
      .calls[2][0].view as View;
    const rebuiltPreviousTag = findPreviousTagSelect(rebuiltView);

    expect(rebuiltPreviousTag.element.initial_option?.value).toEqual(
      deliveryConfiguration.tags[0],
    );
    // A block_id Slack has never seen, so it drops the value already held in
    // state (ban-offer-history's tag) and applies the new initial_option.
    expect(initialPreviousTag.block.block_id).toEqual(
      `release-previous-tag-block-${banOfferHistory.id}`,
    );
    expect(rebuiltPreviousTag.block.block_id).toEqual(
      `release-previous-tag-block-${deliveryConfiguration.id}`,
    );
    expect(rebuiltPreviousTag.block.block_id).not.toEqual(
      initialPreviousTag.block.block_id,
    );
    expect(rebuiltPreviousTag.element.action_id).toEqual(
      initialPreviousTag.element.action_id,
    );

    /** Step 3: the user clicks Start without touching the previous tag */
    const stateAtSubmission = {
      ...stateAfterSwitch,
      // Slack applied the initial_option of the rebuilt block, while the entry
      // it held for ban-offer-history is still around and must be ignored.
      [rebuiltPreviousTag.block.block_id as string]: {
        'release-select-previous-tag-action': {
          selected_option: rebuiltPreviousTag.element.initial_option,
        },
      },
    };
    body = {
      payload: JSON.stringify({
        type: 'view_submission',
        user: { id: slackUserFixture.id },
        view: {
          ...rebuiltView,
          id: 'viewId',
          state: { values: stateAtSubmission },
        },
      }),
    };
    response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);

    const { hasModelEntry } = (await import('sequelize')) as any;
    await waitFor(async () => {
      const created = await hasModelEntry('Release', {
        projectId: deliveryConfiguration.id,
      });
      if (!created && loggedErrorMessages().length === 0) {
        throw new Error('release still pending');
      }
    });

    expect(loggedErrorMessages()).toEqual([]);
    expect(
      await hasModelEntry('Release', {
        projectId: deliveryConfiguration.id,
        tagName: releaseTagName,
      }),
    ).toEqual(true);
  });

  it('falls back to the selected project tag when the submitted one belongs to another project', async () => {
    // The scoped block id keeps the modal from offering a foreign tag, but the
    // submitted value still comes from the client, and a release manager
    // building its own modal picks its own block id.
    const releaseTagName = 'stable-20260903-0900';

    mockProject(banOfferHistory);
    mockProject(deliveryConfiguration);
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/pipelines?ref=master`,
      [pipelineFixture],
    );
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/pipelines?ref=${releaseTagName}`,
      [pipelineFixture],
    );
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/pipelines/${pipelineFixture.id}/jobs?per_page=100`,
      [dockerBuildJobFixture, jobFixture],
    );
    mockGitlabCall(
      `/projects/${deliveryConfiguration.id}/releases`,
      releaseFixture,
    );
    (slackBotWebClient.users.info as jest.Mock).mockResolvedValue({
      user: slackUserFixture,
    });
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });

    const body = {
      payload: JSON.stringify({
        type: 'view_submission',
        user: { id: slackUserFixture.id },
        view: {
          blocks: [],
          callback_id: 'release-create-modal',
          id: 'viewId',
          state: {
            values: {
              'release-project-block': {
                'release-select-project-action': {
                  selected_option: { value: `${deliveryConfiguration.id}` },
                },
              },
              'release-tag-block': {
                'release-tag-action': { value: releaseTagName },
              },
              [`release-previous-tag-block-${deliveryConfiguration.id}`]: {
                'release-select-previous-tag-action': {
                  selected_option: { value: banOfferHistory.tags[0] },
                },
              },
            },
          },
        },
      }),
    };
    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);
    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);

    const { hasModelEntry } = (await import('sequelize')) as any;
    await waitFor(async () => {
      const created = await hasModelEntry('Release', {
        projectId: deliveryConfiguration.id,
      });
      if (!created && loggedErrorMessages().length === 0) {
        throw new Error('release still pending');
      }
    });

    // ban-offer-history's tag never reaches generateChangelog.
    expect(loggedErrorMessages()).toEqual([]);
    expect(
      await hasModelEntry('Release', {
        projectId: deliveryConfiguration.id,
        tagName: releaseTagName,
      }),
    ).toEqual(true);
  });
});
