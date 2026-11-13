import { federationReleaseTagManager } from '@/release/commands/create/managers/federationReleaseTagManager';
import { stableDateReleaseTagManager } from '@/release/commands/create/managers/stableDateReleaseTagManager';
import { buildProjectReleaseConfigs } from '@/release/utils/configBuilder';
import defaultReleaseManager from '@root/plugins/release/defaultReleaseManager';

describe('configBuilder', () => {
  it('should build configs', async () => {
    const projects = [
      {
        releaseManager: 'defaultReleaseManager',
        releaseTagManager: 'federationReleaseTagManager',
        notificationChannelIds: ['C678'],
        projectId: 123,
        releaseChannelId: 'C456',
      },
      {
        releaseManager: 'defaultReleaseManager',
        notificationChannelIds: ['C678'],
        projectId: 890,
        releaseChannelId: 'C456',
      },
    ];
    expect(
      await buildProjectReleaseConfigs(
        { projects },
        { federationReleaseTagManager },
      ),
    ).toEqual([
      {
        notificationChannelIds: ['C678'],
        projectId: 123,
        releaseChannelId: 'C456',
        releaseManager: defaultReleaseManager,
        releaseTagManager: federationReleaseTagManager,
      },
      {
        notificationChannelIds: ['C678'],
        projectId: 890,
        releaseChannelId: 'C456',
        releaseManager: defaultReleaseManager,
      },
    ]);
  });
  it('should load a third party release manager', async () => {
    const projects = [
      {
        releaseManager: 'defaultReleaseManager',
        releaseTagManager: 'stableDateReleaseTagManager',
        notificationChannelIds: ['C678'],
        projectId: 123,
        releaseChannelId: 'C456',
      },
    ];
    expect(
      await buildProjectReleaseConfigs(
        { projects },
        { federationReleaseTagManager, stableDateReleaseTagManager },
      ),
    ).toEqual([
      {
        notificationChannelIds: ['C678'],
        projectId: 123,
        releaseChannelId: 'C456',
        releaseManager: defaultReleaseManager,
        releaseTagManager: stableDateReleaseTagManager,
      },
    ]);
  });
  it('should throw an error if projects is not an array', async () => {
    expect(() =>
      buildProjectReleaseConfigs({} as any, { federationReleaseTagManager }),
    ).rejects.toThrow(
      'The config file should contain an array of valid project configurations',
    );
  });
  it('should throw an error if there is an invalid project configuration', async () => {
    expect(() =>
      buildProjectReleaseConfigs(
        [{ projectId: 123, releaseManager: 'defaultReleaseManager' }] as any,
        { federationReleaseTagManager },
      ),
    ).rejects.toThrow(
      'The config file should contain an array of valid project configurations',
    );
  });
  it('should compile the ignored note author pattern', async () => {
    const projects = [
      {
        releaseManager: 'defaultReleaseManager',
        notificationChannelIds: ['C678'],
        projectId: 123,
        releaseChannelId: 'C456',
        ignoredNoteAuthorPattern: '^(project|group)_\\d+_bot',
      },
    ];

    const [config] = await buildProjectReleaseConfigs({ projects }, {});

    expect(config.ignoredNoteAuthorRegex).toEqual(/^(project|group)_\d+_bot/);
  });
  it('should reject an invalid ignored note author pattern', async () => {
    const projects = [
      {
        releaseManager: 'defaultReleaseManager',
        notificationChannelIds: ['C678'],
        projectId: 123,
        releaseChannelId: 'C456',
        ignoredNoteAuthorPattern: '^(project|group',
      },
    ];

    await expect(buildProjectReleaseConfigs({ projects }, {})).rejects.toThrow(
      /Invalid ignoredNoteAuthorPattern for project 123: .*Unterminated group/,
    );
  });
});
