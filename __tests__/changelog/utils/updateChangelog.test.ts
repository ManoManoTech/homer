import type { AnyBlock } from '@slack/types/dist/block-kit/blocks';
import type { InputBlock, StaticSelect, View } from '@slack/web-api';
import { buildChangelogModalView } from '@/changelog/buildChangelogModalView';
import { updateChangelog } from '@/changelog/utils/updateChangelog';
import { slackBotWebClient } from '@/core/services/slack';
import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
import { cleanViewState } from '@/core/utils/cleanViewState';

// Mock Slack client entirely to avoid constructing real WebClient
jest.mock('@/core/services/slack', () => ({
  slackBotWebClient: {
    views: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

// Spy/mocks for helpers used inside updateChangelog
jest.mock('@/core/utils/cleanViewState', () => ({
  cleanViewState: jest.fn(),
}));

jest.mock('@/changelog/buildChangelogModalView', () => ({
  buildChangelogModalView: jest.fn(),
}));

// Helper builders
const makeStaticSelectBlock = (
  options: { text: string; value: string }[],
): InputBlock => ({
  type: 'input',
  block_id: 'changelog-project-block',
  element: {
    type: 'static_select',
    action_id: 'changelog-select-project-action',
    options: options.map(({ text, value }) => ({
      text: { type: 'plain_text', text },
      value,
    })),
  } as unknown as StaticSelect,
  label: { type: 'plain_text', text: 'Project' },
});

const makePayload = ({
  blocks,
  projectIdValue,
  releaseTagValue,
}: {
  blocks: AnyBlock[];
  projectIdValue: string;
  releaseTagValue?: string;
}): BlockActionsPayload => ({
  actions: [],
  api_app_id: 'app',
  container: {
    type: 'message',
    message_ts: 'ts',
    attachment_id: 1,
    channel_id: 'C123',
    is_ephemeral: false,
    is_app_unfurl: false,
  },
  message: { bot_id: 'B', text: '', ts: 'ts', type: 'message', user: 'U' },
  response_url: 'https://example.com',
  team: { id: 'T', domain: 'd' },
  token: 'token',
  trigger_id: 'trigger',
  type: 'block_actions',
  user: { id: 'U', username: 'u', team_id: 'T' },
  view: {
    id: 'V123',
    team_id: 'T',
    state: {
      values: {
        'changelog-project-block': {
          'changelog-select-project-action': {
            selected_option: { value: projectIdValue },
          },
        },
        ...(releaseTagValue !== undefined
          ? {
              'changelog-release-tag-block': {
                'changelog-select-release-tag-action': {
                  selected_option: { value: releaseTagValue },
                },
              },
            }
          : {}),
      },
    },
    hash: 'hash',
    root_view_id: 'root',
    app_id: 'app',
    app_installed_team_id: 'T',
    bot_id: 'B',
    callback_id: 'changelog-modal',
    submit: { type: 'plain_text', text: 'Ok' },
    title: { type: 'plain_text', text: 'Changelog' },
    type: 'modal',
    blocks: blocks,
  },
});

const makeFinalView = (): View =>
  ({
    type: 'modal',
    callback_id: 'final',
    title: { type: 'plain_text', text: 'Final' },
    submit: { type: 'plain_text', text: 'Ok' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Final content' },
      },
    ],
  }) as any;

describe('updateChangelog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('trims blocks after release-tag info, cleans state, shows loader, and then updates with built view', async () => {
    // Arrange: initial blocks include project input, release tag input, info block, and some trailing preview blocks
    const projectOptions = [
      { text: 'proj/a', value: '101' },
      { text: 'proj/b', value: '102' },
    ];

    const blocks = [
      makeStaticSelectBlock(projectOptions),
      {
        type: 'input',
        block_id: 'changelog-release-tag-block',
        element: {
          type: 'static_select',
          action_id: 'changelog-select-release-tag-action',
          options: [
            { text: { type: 'plain_text', text: 'v1.0.0' }, value: 'v1.0.0' },
          ],
        },
        label: { type: 'plain_text', text: 'Previous release tag' },
      },
      {
        type: 'context',
        block_id: 'changelog-release-tag-info-block',
        elements: [{ type: 'plain_text', text: 'Info' }],
      },
      // Blocks that should be removed by updateChangelog before showing loader
      {
        type: 'section',
        block_id: 'to-remove-1',
        text: { type: 'mrkdwn', text: 'X' },
      },
      {
        type: 'section',
        block_id: 'to-remove-2',
        text: { type: 'mrkdwn', text: 'Y' },
      },
    ];

    const payload = makePayload({
      blocks,
      projectIdValue: '101',
      releaseTagValue: 'v1.0.0',
    });

    (buildChangelogModalView as jest.Mock).mockResolvedValue(makeFinalView());

    // Act
    await updateChangelog(payload);

    // Assert
    expect(cleanViewState).toHaveBeenCalledTimes(1);
    expect(cleanViewState).toHaveBeenCalledWith(payload.view);

    // First call shows loader and trimmed blocks
    expect(slackBotWebClient.views.update).toHaveBeenCalledTimes(2);
    const firstCallArg = (slackBotWebClient.views.update as jest.Mock).mock
      .calls[0][0];
    expect(firstCallArg.view_id).toBe('V123');
    expect(
      firstCallArg.view.blocks.some(
        (b: AnyBlock) => b.block_id === 'to-remove-1',
      ),
    ).toBe(false);
    expect(
      firstCallArg.view.blocks.some(
        (b: AnyBlock) => b.block_id === 'to-remove-2',
      ),
    ).toBe(false);
    expect(
      firstCallArg.view.blocks.some(
        (b: AnyBlock) => b.block_id === 'changelog-release-tag-info-block',
      ),
    ).toBe(true);
    expect(firstCallArg.view.blocks.at(-1)).toEqual({
      type: 'section',
      text: { type: 'plain_text', text: ':loader:' },
    });

    // buildChangelogModalView called with expected args
    const expectedProjectOptions = (
      (blocks[0] as InputBlock).element as StaticSelect
    ).options;
    expect(buildChangelogModalView).toHaveBeenCalledWith({
      projectId: 101,
      projectOptions: expectedProjectOptions,
      releaseTagName: 'v1.0.0',
    });

    // Second call uses the final view returned
    const secondCallArg = (slackBotWebClient.views.update as jest.Mock).mock
      .calls[1][0];
    expect(secondCallArg.view).toEqual(makeFinalView());
  });

  it('handles absence of release-tag info block without cleaning state, still shows loader then final view', async () => {
    const projectOptions = [{ text: 'proj/a', value: '201' }];

    const blocks = [
      makeStaticSelectBlock(projectOptions),
      // No release-tag-info block here
      {
        type: 'section',
        block_id: 'something-else',
        text: { type: 'mrkdwn', text: 'A' },
      },
    ];

    const payload = makePayload({
      blocks,
      projectIdValue: '201',
      releaseTagValue: undefined,
    });

    const finalView = makeFinalView();
    (buildChangelogModalView as jest.Mock).mockResolvedValue(finalView);

    await updateChangelog(payload);

    // cleanViewState NOT called
    expect(cleanViewState).not.toHaveBeenCalled();

    // buildChangelogModalView called with undefined releaseTagName
    const expectedProjectOptions = (
      (blocks[0] as InputBlock).element as StaticSelect
    ).options;
    expect(buildChangelogModalView).toHaveBeenCalledWith({
      projectId: 201,
      projectOptions: expectedProjectOptions,
      releaseTagName: undefined,
    });

    // Two updates: loader then final
    expect(slackBotWebClient.views.update).toHaveBeenCalledTimes(2);
    const firstCallArg = (slackBotWebClient.views.update as jest.Mock).mock
      .calls[0][0];
    expect(firstCallArg.view.blocks.at(-1)).toEqual({
      type: 'section',
      text: { type: 'plain_text', text: ':loader:' },
    });
    const secondCallArg = (slackBotWebClient.views.update as jest.Mock).mock
      .calls[1][0];
    expect(secondCallArg.view).toEqual(finalView);
  });
});
