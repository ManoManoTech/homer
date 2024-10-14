import { federationReleaseTagManager } from '@/release/commands/create/managers/federationReleaseTagManager';
import { semanticReleaseTagManager } from '@/release/commands/create/managers/semanticReleaseTagManager';
import { stableDateReleaseTagManager } from '@/release/commands/create/managers/stableDateReleaseTagManager';
import type { ReleaseManager } from '@/release/typings/ReleaseManager';
import type { ReleaseTagManager } from '@/release/typings/ReleaseTagManager';

export default class ReleasePluginManager {
  // singleton to load release and release tag managers
  private static instance: ReleasePluginManager = new ReleasePluginManager();
  private readonly releaseManagers: Map<string, ReleaseManager> = new Map();
  private readonly releaseTagManagers: Map<string, ReleaseTagManager> =
    new Map();

  private constructor() {
    // provided release tag managers
    this.releaseTagManagers.set(
      'semanticReleaseTagManager',
      semanticReleaseTagManager
    );
    this.releaseTagManagers.set(
      'federationReleaseTagManager',
      federationReleaseTagManager
    );
    this.releaseTagManagers.set(
      'stableDateReleaseTagManager',
      stableDateReleaseTagManager
    );
  }

  /**
   * Dynamically load a plugin from the given path
   * @param path where the plugin is located
   * @returns default export of the plugin
   */
  static async loadReleaseManagerPlugin(path: string) {
    const errMessage =
      'Cannot load release manager plugin. Invalid path or plugin already loaded.';
    const releaseManagerName = path.split('/').pop()!;
    if (this.instance.releaseManagers.has(releaseManagerName)) {
      throw new Error(errMessage);
    }
    try {
      // import default export from the given path
      const { default: releaseManager } = await import(path);
      // add the release manager to the map
      this.instance.releaseManagers.set(releaseManagerName, releaseManager);
      return releaseManager;
    } catch (error) {
      throw new Error(errMessage);
    }
  }

  static getReleaseManager(name: string) {
    return this.instance.releaseManagers.get(name);
  }

  static getReleaseTagManager(name: string) {
    return this.instance.releaseTagManagers.get(name);
  }
}
