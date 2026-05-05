import type { InputBlock, StaticSelect } from '@slack/web-api';
import { buildChangelogModalView } from '@/changelog/buildChangelogModalView';
import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { getProjectsByChannelId } from '@/core/services/data';
import { fetchProjectById, fetchProjectTags } from '@/core/services/gitlab';
import { SLACK_OPTION_TEXT_MAX_LENGTH } from '@/core/utils/truncateProjectPath';
import { projectFixture } from '../__fixtures__/projectFixture';

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
});
