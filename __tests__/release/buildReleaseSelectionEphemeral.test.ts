import type { SectionBlock, StaticSelect } from '@slack/web-api';
import { fetchProjectById } from '@/core/services/gitlab';
import type { DataRelease } from '@/core/typings/Data';
import { SLACK_OPTION_TEXT_MAX_LENGTH } from '@/core/utils/truncateProjectPath';
import { buildReleaseSelectionEphemeral } from '@/release/viewBuilders/buildReleaseSelectionEphemeral';
import { projectFixture } from '../__fixtures__/projectFixture';

jest.mock('@/core/services/gitlab', () => ({
  ...jest.requireActual('@/core/services/gitlab'),
  fetchProjectById: jest.fn(),
}));

describe('buildReleaseSelectionEphemeral', () => {
  it('truncates long project paths in the option-group label', async () => {
    const longPath = `${'group/'.repeat(15)}very-long-project-name`;
    expect(longPath.length).toBeGreaterThan(SLACK_OPTION_TEXT_MAX_LENGTH);

    (fetchProjectById as jest.Mock).mockResolvedValue({
      ...projectFixture,
      path_with_namespace: longPath,
    });

    const release = {
      projectId: projectFixture.id,
      tagName: 'stable-19700101-0100',
    } as DataRelease;

    const result = await buildReleaseSelectionEphemeral({
      action: 'cancel',
      channelId: 'channelId',
      releases: [release],
      userId: 'userId',
    });

    const accessory = (result as { blocks: SectionBlock[] }).blocks[0]
      .accessory as StaticSelect;
    const groupLabelText = accessory.option_groups?.[0].label.text as string;

    expect(groupLabelText.length).toBeLessThanOrEqual(
      SLACK_OPTION_TEXT_MAX_LENGTH,
    );
    expect(groupLabelText.endsWith('…/very-long-project-name')).toBe(true);
  });
});
