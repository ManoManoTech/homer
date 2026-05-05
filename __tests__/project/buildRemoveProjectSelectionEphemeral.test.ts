import type { SectionBlock, StaticSelect } from '@slack/web-api';
import { getProjectsByChannelId } from '@/core/services/data';
import { fetchProjectById } from '@/core/services/gitlab';
import { SLACK_OPTION_TEXT_MAX_LENGTH } from '@/core/utils/truncateProjectPath';
import { buildRemoveProjectSelectionEphemeral } from '@/project/commands/remove/buildRemoveProjectSelectionEphemeral';
import { projectFixture } from '../__fixtures__/projectFixture';

jest.mock('@/core/services/data', () => ({
  ...jest.requireActual('@/core/services/data'),
  getProjectsByChannelId: jest.fn(),
}));

jest.mock('@/core/services/gitlab', () => ({
  ...jest.requireActual('@/core/services/gitlab'),
  fetchProjectById: jest.fn(),
}));

describe('buildRemoveProjectSelectionEphemeral', () => {
  it('truncates long project paths in the option text but keeps the full path in the option value', async () => {
    const longPath = `${'group/'.repeat(15)}very-long-project-name`;
    expect(longPath.length).toBeGreaterThan(SLACK_OPTION_TEXT_MAX_LENGTH);

    (getProjectsByChannelId as jest.Mock).mockResolvedValue([
      { projectId: projectFixture.id },
    ]);
    (fetchProjectById as jest.Mock).mockResolvedValue({
      ...projectFixture,
      path_with_namespace: longPath,
    });

    const result = await buildRemoveProjectSelectionEphemeral({
      channelId: 'channelId',
      userId: 'userId',
    });

    const accessory = (result as { blocks: SectionBlock[] }).blocks[0]
      .accessory as StaticSelect;
    const option = accessory.options?.[0];
    const text = option?.text.text as string;

    expect(text.length).toBeLessThanOrEqual(SLACK_OPTION_TEXT_MAX_LENGTH);
    expect(text.endsWith('…/very-long-project-name')).toBe(true);
    expect(option?.value).toContain(longPath);
  });
});
