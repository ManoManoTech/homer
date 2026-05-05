import type { SectionBlock, StaticSelect } from '@slack/web-api';
import type { GitlabProject } from '@/core/typings/GitlabProject';
import { SLACK_OPTION_TEXT_MAX_LENGTH } from '@/core/utils/truncateProjectPath';
import { buildAddProjectSelectionEphemeral } from '@/project/commands/add/buildAddProjectSelectionEphemeral';
import { projectFixture } from '../__fixtures__/projectFixture';

describe('buildAddProjectSelectionEphemeral', () => {
  it('keeps short project paths unchanged in the option text', () => {
    const result = buildAddProjectSelectionEphemeral({
      channelId: 'channelId',
      projects: [projectFixture as GitlabProject],
      query: 'search',
      userId: 'userId',
    });

    const accessory = (result as { blocks: SectionBlock[] }).blocks[0]
      .accessory as StaticSelect;
    expect(accessory.options?.[0].text.text).toBe(
      projectFixture.path_with_namespace,
    );
  });

  it('truncates project paths longer than the Slack 75-char option-text limit', () => {
    const longPath = `${'group/'.repeat(15)}very-long-project-name`;
    expect(longPath.length).toBeGreaterThan(SLACK_OPTION_TEXT_MAX_LENGTH);

    const longProject: GitlabProject = {
      ...(projectFixture as GitlabProject),
      path_with_namespace: longPath,
    };

    const result = buildAddProjectSelectionEphemeral({
      channelId: 'channelId',
      projects: [longProject],
      query: 'search',
      userId: 'userId',
    });

    const accessory = (result as { blocks: SectionBlock[] }).blocks[0]
      .accessory as StaticSelect;
    const text = accessory.options?.[0].text.text as string;

    expect(text.length).toBeLessThanOrEqual(SLACK_OPTION_TEXT_MAX_LENGTH);
    expect(text.endsWith('…/very-long-project-name')).toBe(true);
  });
});
