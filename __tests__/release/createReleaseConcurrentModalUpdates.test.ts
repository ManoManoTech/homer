import type { InputBlock, StaticSelect, View } from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_OK } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabTag } from '@/core/typings/GitlabTag';
import { projectFixture } from '../__fixtures__/projectFixture';
import { tagFixture } from '../__fixtures__/tagFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

const CHANNEL_ID = 'C0XXXXXXXXX';

const slowProject = {
  id: 5050,
  path: 'deliver/a-slow-project',
  tags: ['stable-20260101-1000', 'stable-20260101-1001'],
};
const fastProject = {
  id: 16271,
  path: 'deliver/b-fast-project',
  tags: ['stable-20260202-2000', 'stable-20260202-2001'],
};

jest.mock('@root/config/homer/projects.json', () => ({
  projects: [
    {
      description: 'a-slow-project',
      notificationChannelIds: ['C0XXXXXXXXX'],
      projectId: 5050,
      releaseChannelId: 'C0XXXXXXXXX',
      releaseManager: 'defaultReleaseManager',
      releaseTagManager: 'stableDateReleaseTagManager',
    },
    {
      description: 'b-fast-project',
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
    commit: { ...tagFixture.commit, created_at: '2026-01-01T10:00:00.000Z' },
  };
}

function mockProject({ id, path, tags }: typeof slowProject) {
  mockGitlabCall(`/projects/${id}`, {
    ...projectFixture,
    id,
    path_with_namespace: path,
  });
  mockGitlabCall(
    `/projects/${id}/repository/tags?per_page=100`,
    tags.map(buildTag),
  );
  mockGitlabCall(
    `/projects/${id}/releases?per_page=100`,
    tags.map((name, i) => ({
      tag_name: name,
      name,
      released_at: `2026-0${id === 5050 ? 1 : 2}-0${2 - i}T10:00:00.000Z`,
    })),
  );
  tags.forEach((name) =>
    mockGitlabCall(`/projects/${id}/repository/tags/${name}`, buildTag(name)),
  );
  return mockGitlabCall(
    `/projects/${id}/repository/commits?since=2026-01-01T10:00:01.000Z&per_page=100`,
    [],
  );
}

/** Last view Slack actually applied, rejected updates excluded. */
let appliedView: View | undefined;

function lastUpdatedView(): View {
  if (appliedView === undefined) {
    throw new Error('No view has been applied yet');
  }
  return appliedView;
}

function selectedProjectOf(view: View): string | undefined {
  const block = view.blocks.find(
    ({ block_id }) => block_id === 'release-project-block',
  ) as InputBlock | undefined;
  return (block?.element as StaticSelect)?.initial_option?.value;
}

function previousTagOptionsOf(view: View): string[] {
  const block = view.blocks.find(
    ({ block_id }) => block_id === 'release-previous-tag-block',
  ) as InputBlock | undefined;
  const element = block?.element as unknown as {
    option_groups?: { options: { value: string }[] }[];
  };
  return (element?.option_groups ?? []).flatMap((group) =>
    group.options.map(({ value }) => value),
  );
}

async function postBlockAction(actionId: string, view: unknown) {
  const body = {
    payload: JSON.stringify({
      type: 'block_actions',
      actions: [{ action_id: actionId }],
      view,
    }),
  };
  return request(app)
    .post('/api/v1/homer/interactive')
    .set(getSlackHeaders(body))
    .send(body);
}

/**
 * Emulates the view hash Slack maintains: every update bumps it, and an update
 * carrying an outdated one is rejected with hash_conflict.
 */
function mockSlackViewStore() {
  let currentHash = 'hash-0';
  let counter = 0;
  appliedView = undefined;

  (slackBotWebClient.views.update as jest.Mock).mockImplementation(
    async ({ hash, view }: { hash?: string; view: View }) => {
      if (hash !== undefined && hash !== currentHash) {
        throw Object.assign(new Error('An API error occurred'), {
          data: { ok: false, error: 'hash_conflict' },
        });
      }
      counter += 1;
      currentHash = `hash-${counter}`;
      appliedView = view;
      return { ok: true, view: { ...view, hash: currentHash } };
    },
  );
}

describe('release > concurrent modal updates', () => {
  it('leaves the modal on the newly selected project when a changelog rebuild is still in flight', async () => {
    const slowCommitsMock = mockProject(slowProject);
    mockProject(fastProject);
    mockSlackViewStore();
    (slackBotWebClient.views.open as jest.Mock).mockResolvedValue({
      view: { id: 'viewId' },
    });

    /** Open the modal on the first project. */
    const openBody: Record<string, unknown> = {
      channel_id: CHANNEL_ID,
      text: 'release',
      trigger_id: 'triggerId',
    };
    await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(openBody))
      .send(openBody);

    const initialView = lastUpdatedView();
    expect(selectedProjectOf(initialView)).toEqual(`${slowProject.id}`);

    /**
     * Hold the changelog fetch of the first project open, so its rebuild is
     * still pending when the project switch is handled.
     */
    let releaseSlowCommits!: () => void;
    slowCommitsMock.gate = new Promise<void>((resolve) => {
      releaseSlowCommits = resolve;
    });

    const changelogState = {
      'release-project-block': {
        'release-select-project-action': {
          selected_option: { value: `${slowProject.id}` },
        },
      },
      'release-previous-tag-block': {
        'release-select-previous-tag-action': {
          selected_option: { value: slowProject.tags[1] },
        },
      },
    };
    const changelogRequest = postBlockAction(
      'release-select-previous-tag-action',
      {
        ...initialView,
        id: 'viewId',
        state: { values: changelogState },
      },
    );

    /** While it is pending, the user switches to the other project. */
    const switchState = {
      'release-project-block': {
        'release-select-project-action': {
          selected_option: { value: `${fastProject.id}` },
        },
      },
      'release-previous-tag-block': {
        'release-select-previous-tag-action': {
          selected_option: { value: slowProject.tags[1] },
        },
      },
    };
    const switchResponse = await postBlockAction(
      'release-select-project-action',
      {
        ...initialView,
        id: 'viewId',
        state: { values: switchState },
      },
    );
    expect(switchResponse.status).toEqual(HTTP_STATUS_OK);

    /** The slow changelog rebuild now completes, after the switch. */
    releaseSlowCommits();
    await changelogRequest;
    await new Promise((resolve) => setImmediate(resolve));

    const finalView = lastUpdatedView();

    // The tag list is what betrays the stale rebuild: the project select keeps
    // showing the first project either way, because its initial_option is
    // always projectOptions[0].
    expect(previousTagOptionsOf(finalView)).toEqual(fastProject.tags);
  });
});
