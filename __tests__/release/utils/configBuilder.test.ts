import { defaultReleaseManager } from '@/release/commands/create/managers/defaultReleaseManager';
import { federationReleaseTagManager } from '@/release/commands/create/managers/federationReleaseTagManager';
import { buildProjectReleaseConfigs } from '@/release/utils/configBuilder';

describe('configBuilder', () => {
  it('should build configs', () => {
    const configs = [
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
        configs,
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
  it('should return empty array if configs is not an array', () => {
    expect(
      buildProjectReleaseConfigs(
        {} as any,
        { defaultReleaseManager },
        { federationReleaseTagManager }
      )
    ).toEqual([]);
  });
  it('should return empty array if no valid configurations', () => {
    expect(
      buildProjectReleaseConfigs(
        [{ projectId: 123, releaseManager: 'defaultReleaseManager' }] as any,
        { defaultReleaseManager },
        { federationReleaseTagManager }
      )
    ).toEqual([]);
  });
});
