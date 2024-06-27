export interface ReleaseTagManager {
  createReleaseTag(previousReleaseTag?: string): string;
  isReleaseTag(tag: string): boolean;
}
