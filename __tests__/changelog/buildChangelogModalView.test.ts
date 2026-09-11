import type {
  InputBlock,
  PlainTextInput,
  StaticSelect,
  View,
} from '@slack/web-api';
import { buildChangelogModalView } from '@/changelog/buildChangelogModalView';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { getProjectsByChannelId } from '@/core/services/data';
import { fetchProjectById, fetchProjectTags } from '@/core/services/gitlab';
import type { SlackOption } from '@/core/typings/SlackOption';
import { SLACK_OPTION_TEXT_MAX_LENGTH } from '@/core/utils/truncateProjectPath';
import { projectFixture } from '../__fixtures__/projectFixture';

function findBlockByActionId(view: View, actionId: string) {
  return view.blocks.find(
    (block) =>
      ((block as InputBlock).element as StaticSelect | PlainTextInput)
        ?.action_id === actionId,
  ) as InputBlock | undefined;
}

jest.mock('@/core/services/data', () => ({
  ...jest.requireActual('@/core/services/data'),
  getProjectsByChannelId: jest.fn(),
}));

jest.mock('@/core/services/gitlab', () => ({
  ...jest.requireActual('@/core/services/gitlab'),
  fetchProjectById: jest.fn(),
  fetchProjectTags: jest.fn(),
}));

jest.mock('@/changelog/utils/generateChangelog', () => ({
  generateChangelog: jest.fn(),
}));

describe('buildChangelogModalView', () => {
  it('truncates long project paths in the project picker option text', async () => {
    const longPath = `${'group/'.repeat(15)}very-long-project-name`;
    expect(longPath.length).toBeGreaterThan(SLACK_OPTION_TEXT_MAX_LENGTH);

    (getProjectsByChannelId as jest.Mock).mockResolvedValue([
      { projectId: projectFixture.id },
    ]);
    (fetchProjectById as jest.Mock).mockResolvedValue({
      ...projectFixture,
      path_with_namespace: longPath,
    });
    (fetchProjectTags as jest.Mock).mockResolvedValue([]);
    (generateChangelog as jest.Mock).mockResolvedValue('');

    const view = await buildChangelogModalView({ channelId: 'channelId' });

    const projectBlock = view.blocks[0] as InputBlock;
    const select = projectBlock.element as StaticSelect;
    const text = select.options?.[0].text.text as string;

    expect(text.length).toBeLessThanOrEqual(SLACK_OPTION_TEXT_MAX_LENGTH);
    expect(text.endsWith('…/very-long-project-name')).toBe(true);
  });

  it('should key the block ids on the displayed data, and select the requested tag', async () => {
    (fetchProjectById as jest.Mock).mockResolvedValue(projectFixture);
    (fetchProjectTags as jest.Mock).mockResolvedValue([
      { name: '1.2.3' },
      { name: '1.2.2' },
    ]);
    (generateChangelog as jest.Mock).mockResolvedValue('- A change');

    const view = await buildChangelogModalView({
      projectId: projectFixture.id,
      projectOptions: [
        {
          text: { type: 'plain_text', text: 'diaspora/diaspora-project-site' },
          value: `${projectFixture.id}`,
        },
      ] as SlackOption[],
      releaseTagName: '1.2.2',
    });

    const releaseTagBlock = findBlockByActionId(
      view,
      'changelog-select-release-tag-action',
    );
    const markdownBlock = findBlockByActionId(
      view,
      'changelog-markdown-action',
    );

    // The ids embed the data the inputs display, so that Slack rebuilds them
    // instead of preserving the values of the previously selected project.
    expect(releaseTagBlock?.block_id).toEqual(
      `changelog-release-tag-block-${projectFixture.id}`,
    );
    expect(markdownBlock?.block_id).toEqual(
      `changelog-markdown-block-${projectFixture.id}-1.2.2`,
    );

    // And the tag asked for is the selected one, not merely the latest.
    expect(
      (releaseTagBlock?.element as StaticSelect).initial_option?.value,
    ).toEqual('1.2.2');
    expect((markdownBlock?.element as PlainTextInput).initial_value).toEqual(
      '- A change',
    );
  });
});
