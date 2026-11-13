import type { SectionBlock, StaticSelect } from '@slack/web-api';
import type { UnifiedProject } from '@/core/typings/UnifiedModels';
import { SLACK_OPTION_TEXT_MAX_LENGTH } from '@/core/utils/truncateProjectPath';
import { buildAddProjectSelectionEphemeral } from '@/project/commands/add/buildAddProjectSelectionEphemeral';
import { projectFixture } from '../__fixtures__/projectFixture';

const project: UnifiedProject = {
  provider: 'gitlab',
  id: projectFixture.id,
  path: projectFixture.path_with_namespace,
  webUrl: projectFixture.web_url,
  defaultBranch: projectFixture.default_branch,
};

describe('buildAddProjectSelectionEphemeral', () => {
  it('keeps short project paths unchanged in the option text', () => {
    const result = buildAddProjectSelectionEphemeral({
      channelId: 'channelId',
      projects: [project],
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

    const longProject: UnifiedProject = { ...project, path: longPath };

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
