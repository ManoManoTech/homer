export interface ReleaseTagManager {
  createReleaseTag(previousReleaseTag?: string): string;
  isReleaseTag(tag: string, appName?: string): boolean;
  extractAppName?(tag: string): string;
}
