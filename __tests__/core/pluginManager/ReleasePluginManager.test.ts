import ReleasePluginManager from '@/core/pluginManager/ReleasePluginManager';
import { semanticReleaseTagManager } from '@/release/commands/create/managers/semanticReleaseTagManager';
import defaultReleaseManager from '@root/plugins/release/defaultReleaseManager';

describe('pluginManager', () => {
  beforeAll(async () => {
    // Due to singleton pattern, the release manager may already be loaded during test launch
    if (!ReleasePluginManager.getReleaseManager('defaultReleaseManager')) {
      await ReleasePluginManager.loadReleaseManagerPlugin(
        '@root/plugins/release/defaultReleaseManager'
      );
    }
  });
  it('should throw an error if the plugin is not found', async () => {
    await expect(async () =>
      ReleasePluginManager.loadReleaseManagerPlugin('invalidPath')
    ).rejects.toThrow(
      'Cannot load release manager plugin. Invalid path or plugin already loaded.'
    );
  });
  it('should throw an error if the plugin is already added', async () => {
    await expect(async () =>
      ReleasePluginManager.loadReleaseManagerPlugin(
        '@root/plugins/release/defaultReleaseManager'
      )
    ).rejects.toThrow(
      'Cannot load release manager plugin. Invalid path or plugin already loaded.'
    );
  });
  it('should return release manager by name', async () => {
    expect(
      ReleasePluginManager.getReleaseManager('defaultReleaseManager')
    ).toEqual(defaultReleaseManager);
  });
  it('should return a provided release manager', async () => {
    expect(
      ReleasePluginManager.getReleaseManager('defaultReleaseManager')
    ).toEqual(defaultReleaseManager);
  });
  it('should return release tag manager by name', async () => {
    expect(
      ReleasePluginManager.getReleaseTagManager('semanticReleaseTagManager')
    ).toEqual(semanticReleaseTagManager);
  });
});
