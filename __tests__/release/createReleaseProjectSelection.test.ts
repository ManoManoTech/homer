import type { InputBlock, StaticSelect, View } from '@slack/web-api';
import request from 'supertest';
import { app } from '@/app';
import { slackBotWebClient } from '@/core/services/slack';
import type { GitlabTag } from '@/core/typings/GitlabTag';
import { projectFixture } from '../__fixtures__/projectFixture';
import { tagFixture } from '../__fixtures__/tagFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

const CHANNEL_ID = 'C0XXXXXXXXX';

/** Sorted by path, so this one is the project the modal opens on. */
const firstProject = {
  id: 5050,
  path: 'deliver/a-project',
  tags: ['stable-20260101-1000'],
};
const secondProject = {
  id: 16271,
  path: 'deliver/b-project',
  tags: ['stable-20260202-2000'],
};

jest.mock('@root/config/homer/projects.json', () => ({
  projects: [5050, 16271].map((projectId) => ({
    description: `project-${projectId}`,
    notificationChannelIds: ['C0XXXXXXXXX'],
    projectId,
    releaseChannelId: 'C0XXXXXXXXX',
    releaseManager: 'defaultReleaseManager',
    releaseTagManager: 'stableDateReleaseTagManager',
  })),
}));

function buildTag(name: string): GitlabTag {
  return {
    ...tagFixture,
    name,
    commit: { ...tagFixture.commit, created_at: '2026-01-01T10:00:00.000Z' },
  };
}

function mockProject({ id, path, tags }: typeof firstProject) {
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
    tags.map((name) => ({
      tag_name: name,
      name,
      released_at: '2026-01-01T10:00:00.000Z',
    })),
  );
  tags.forEach((name) =>
    mockGitlabCall(`/projects/${id}/repository/tags/${name}`, buildTag(name)),
  );
  mockGitlabCall(
    `/projects/${id}/repository/commits?since=2026-01-01T10:00:01.000Z&per_page=100`,
    [],
  );
}

function projectSelectOf(view: View): StaticSelect {
  const block = view.blocks.find(
    ({ block_id }) => block_id === 'release-project-block',
  ) as InputBlock;
  return block.element as StaticSelect;
}

function lastUpdatedView(): View {
  const calls = (slackBotWebClient.views.update as jest.Mock).mock.calls;
  return calls[calls.length - 1][0].view as View;
}

describe('release > project selection in the release modal', () => {
  beforeEach(() => {
    mockProject(firstProject);
    mockProject(secondProject);
    (slackBotWebClient.views.open as jest.Mock).mockResolvedValue({
      view: { id: 'viewId' },
    });
    (slackBotWebClient.views.update as jest.Mock).mockResolvedValue({
      ok: true,
      view: { hash: 'hash-1' },
    });
  });

  async function openModal(): Promise<View> {
    const body = {
      channel_id: CHANNEL_ID,
      text: 'release',
      trigger_id: 'triggerId',
    };
    await request(app)
      .post('/api/v1/homer/command')
      .set(getSlackHeaders(body))
      .send(body);

    return lastUpdatedView();
  }

  async function switchProjectTo(projectId: number, view: View): Promise<View> {
    const body = {
      payload: JSON.stringify({
        type: 'block_actions',
        actions: [{ action_id: 'release-select-project-action' }],
        view: {
          ...view,
          id: 'viewId',
          state: {
            values: {
              'release-project-block': {
                'release-select-project-action': {
                  selected_option: { value: `${projectId}` },
                },
              },
            },
          },
        },
      }),
    };
    await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(body))
      .send(body);
    await new Promise((resolve) => setImmediate(resolve));

    return lastUpdatedView();
  }

  it('opens on the first project of the channel', async () => {
    const view = await openModal();

    expect(projectSelectOf(view).initial_option?.value).toEqual(
      `${firstProject.id}`,
    );
  });

  it('keeps the project select on the project the user switched to', async () => {
    const initialView = await openModal();

    const rebuiltView = await switchProjectTo(secondProject.id, initialView);

    expect(projectSelectOf(rebuiltView).initial_option?.value).toEqual(
      `${secondProject.id}`,
    );
  });

  it('labels the selected project with its own path', async () => {
    const initialView = await openModal();

    const rebuiltView = await switchProjectTo(secondProject.id, initialView);

    expect(projectSelectOf(rebuiltView).initial_option?.text.text).toEqual(
      secondProject.path,
    );
  });
});
