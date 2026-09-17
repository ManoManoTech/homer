import type { InputBlock, StaticSelect } from '@slack/web-api';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { fetchProjectTags } from '@/core/services/gitlab';
import type { BlockActionView } from '@/core/typings/BlockActionPayload';
import { buildReleaseModalView } from '@/release/commands/create/viewBuilders/buildReleaseModalView';
import { projectFixture } from '../__fixtures__/projectFixture';
import { tagFixture } from '../__fixtures__/tagFixture';

jest.mock('@/core/services/gitlab', () => ({
  ...jest.requireActual('@/core/services/gitlab'),
  fetchProjectTags: jest.fn(),
}));

jest.mock('@/changelog/utils/generateChangelog', () => ({
  generateChangelog: jest.fn(),
}));

const OTHER_PROJECT_ID = 4242;

const projectOptions = [
  {
    text: { type: 'plain_text' as const, text: 'other-project' },
    value: OTHER_PROJECT_ID.toString(),
  },
  {
    text: { type: 'plain_text' as const, text: 'project_example' },
    value: projectFixture.id.toString(),
  },
];

function buildView(state: Record<string, any>): BlockActionView {
  return {
    blocks: [
      {
        type: 'input',
        block_id: 'release-project-block',
        element: {
          type: 'static_select',
          action_id: 'release-select-project-action',
          options: projectOptions,
        },
      },
    ],
    state: { values: state },
  } as unknown as BlockActionView;
}

function selectedProjectState(projectId: number) {
  return {
    'release-project-block': {
      'release-select-project-action': {
        selected_option: { value: projectId.toString() },
      },
    },
  };
}

function findPreviousTagBlock(blocks: any[]) {
  const block = blocks.find(({ block_id }) =>
    block_id?.startsWith('release-previous-tag-block'),
  ) as InputBlock;

  return { block, element: block.element as StaticSelect };
}

describe('release > buildReleaseModalView', () => {
  beforeEach(() => {
    (generateChangelog as jest.Mock).mockResolvedValue('');
    (fetchProjectTags as jest.Mock).mockResolvedValue([
      { ...tagFixture, name: 'stable-20200101-1000' },
      { ...tagFixture, name: 'stable-20191231-0900' },
    ]);
  });

  it('scopes the previous tag block to the selected project', async () => {
    const view = await buildReleaseModalView({
      view: buildView(selectedProjectState(projectFixture.id)),
    });

    const { block } = findPreviousTagBlock(view.blocks);

    expect(block.block_id).toEqual(
      `release-previous-tag-block-${projectFixture.id}`,
    );
  });

  it('ignores the previous tag of a project that is no longer selected', async () => {
    // Slack preserves the value of an input whose block_id and action_id are
    // unchanged across views.update, so a stale entry can survive a project
    // switch. The scoped block_id makes it unreachable.
    const view = await buildReleaseModalView({
      view: buildView({
        ...selectedProjectState(projectFixture.id),
        [`release-previous-tag-block-${OTHER_PROJECT_ID}`]: {
          'release-select-previous-tag-action': {
            selected_option: { value: 'stable-20991231-2359' },
          },
        },
      }),
    });

    const { block, element } = findPreviousTagBlock(view.blocks);

    // A block_id Slack has never seen: the select is rebuilt, not preserved.
    expect(block.block_id).toEqual(
      `release-previous-tag-block-${projectFixture.id}`,
    );
    expect(element.initial_option?.value).toEqual('stable-20200101-1000');
    expect(generateChangelog).toHaveBeenCalledWith(
      projectFixture.id,
      'stable-20200101-1000',
    );
  });

  it('keeps the tag selected within the same project', async () => {
    const view = await buildReleaseModalView({
      view: buildView({
        ...selectedProjectState(projectFixture.id),
        [`release-previous-tag-block-${projectFixture.id}`]: {
          'release-select-previous-tag-action': {
            selected_option: { value: 'stable-20191231-0900' },
          },
        },
      }),
    });

    const { element } = findPreviousTagBlock(view.blocks);

    expect(element.initial_option?.value).toEqual('stable-20191231-0900');
    expect(generateChangelog).toHaveBeenCalledWith(
      projectFixture.id,
      'stable-20191231-0900',
    );
  });
});
