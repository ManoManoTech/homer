import { defaultReleaseManager } from '@/release/commands/create/managers/defaultReleaseManager';
import { federationReleaseTagManager } from '@/release/commands/create/managers/federationReleaseTagManager';
import { multipleProjectReleaseManager } from '@/release/commands/create/managers/multipleProjectReleaseManager';
import { buildProjectReleaseConfigs } from '@/release/utils/configBuilder';

describe('configBuilder', () => {
  it('should build configs', () => {
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
      buildProjectReleaseConfigs(
        { projects },
        { defaultReleaseManager },
        { federationReleaseTagManager }
      )
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
  it('should throw an error if projects is not an array', () => {
    expect(() =>
      buildProjectReleaseConfigs(
        {} as any,
        { defaultReleaseManager },
        { federationReleaseTagManager }
      )
    ).toThrow(
      'The config file should contain an array of valid project configurations'
    );
  });
  it('should throw an error if there is an invalid project configuration', () => {
    expect(() =>
      buildProjectReleaseConfigs(
        [{ projectId: 123, releaseManager: 'defaultReleaseManager' }] as any,
        { defaultReleaseManager },
        { federationReleaseTagManager }
      )
    ).toThrow(
      'The config file should contain an array of valid project configurations'
    );
  });
  it('should build a multiple project config', () => {
    const projects = [
      {
        releaseManager: {
          type: 'multipleProjectReleaseManager' as const,
          config: {
            appNameDefault: 'defaultName',
            appName: 'appName',
            appNameOther: 'otherName',
          },
        },
        releaseTagManager: 'federationReleaseTagManager',
        notificationChannelIds: ['C678'],
        projectId: 123,
        releaseChannelId: 'C456',
      },
    ];
    expect(
      buildProjectReleaseConfigs(
        { projects },
        { defaultReleaseManager },
        { federationReleaseTagManager }
      )
    ).toEqual([
      {
        notificationChannelIds: ['C678'],
        projectId: 123,
        releaseChannelId: 'C456',
        releaseManager: multipleProjectReleaseManager,
        releaseTagManager: federationReleaseTagManager,
      },
    ]);
  });
});
