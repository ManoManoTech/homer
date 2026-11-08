import type { SlackOption } from '@/core/typings/SlackOption';
import type { UnifiedRelease, UnifiedTag } from '@/core/typings/UnifiedModels';

/** Prefix `cancelRelease` puts on the release name of a canceled release. */
export const NOT_DEPLOYED_RELEASE_NAME_PREFIX = '[NOT DEPLOYED] ';

export const RELEASES_GROUP_LABEL = 'Releases';
export const MANUAL_TAGS_GROUP_LABEL = 'Manual tags';
export const NOT_DEPLOYED_GROUP_LABEL = 'Not deployed';

const MAX_RELEASES = 5;
const MAX_MANUAL_TAGS = 3;
const MAX_NOT_DEPLOYED_RELEASES = 2;

export interface PreviousReleaseTagOptionGroup {
  label: { type: 'plain_text'; text: string };
  options: SlackOption[];
}

interface PreviousReleaseTagOptions {
  optionGroups: PreviousReleaseTagOptionGroup[];
  defaultOption?: SlackOption;
}

export function isNotDeployedRelease({ name }: UnifiedRelease): boolean {
  return name?.startsWith(NOT_DEPLOYED_RELEASE_NAME_PREFIX) === true;
}

/**
 * Tags created by Homer are lightweight, so providers sort tags by
 * the tagged commit's date and the tags carry none of their own: releases are
 * ordered by their release date, and tags pushed outside Homer only have the
 * date of the commit they point at.
 */
export function buildPreviousReleaseTagOptionGroups(
  tags: UnifiedTag[],
  releases: UnifiedRelease[],
): PreviousReleaseTagOptions {
  const releaseByTagName = new Map(
    releases.map((release) => [release.tagName, release]),
  );

  const deployed: { tag: UnifiedTag; release: UnifiedRelease }[] = [];
  const notDeployed: { tag: UnifiedTag; release: UnifiedRelease }[] = [];
  const manual: UnifiedTag[] = [];

  tags.forEach((tag) => {
    const release = releaseByTagName.get(tag.name);

    if (release === undefined) {
      manual.push(tag);
    } else if (isNotDeployedRelease(release)) {
      notDeployed.push({ tag, release });
    } else {
      deployed.push({ tag, release });
    }
  });

  const byReleaseDateDesc = (
    a: { release: UnifiedRelease },
    b: { release: UnifiedRelease },
  ) => Date.parse(b.release.releasedAt) - Date.parse(a.release.releasedAt);

  const listedReleases = deployed
    .sort(byReleaseDateDesc)
    .slice(0, MAX_RELEASES);
  const listedNotDeployed = notDeployed
    .sort(byReleaseDateDesc)
    .slice(0, MAX_NOT_DEPLOYED_RELEASES);

  const listedManual = manual
    .sort(
      (a, b) =>
        Date.parse(b.commitDate) - Date.parse(a.commitDate) ||
        b.name.localeCompare(a.name),
    )
    .filter((tag) => isWithinListedReleases(tag, listedReleases))
    .slice(0, MAX_MANUAL_TAGS);

  const releaseOptions = listedReleases.map(({ tag }) => toOption(tag));
  const manualOptions = listedManual.map(toOption);
  const notDeployedOptions = listedNotDeployed.map(({ tag }) => toOption(tag));

  return {
    optionGroups: [
      toOptionGroup(RELEASES_GROUP_LABEL, releaseOptions),
      toOptionGroup(MANUAL_TAGS_GROUP_LABEL, manualOptions),
      toOptionGroup(NOT_DEPLOYED_GROUP_LABEL, notDeployedOptions),
    ].filter(
      (group): group is PreviousReleaseTagOptionGroup => group !== undefined,
    ),
    defaultOption:
      releaseOptions[0] ?? manualOptions[0] ?? notDeployedOptions[0],
  };
}

/**
 * Compares commit dates rather than the release dates listed above: a manual
 * tag has no release date, and it often points at a commit already released.
 */
function isWithinListedReleases(
  tag: UnifiedTag,
  listedReleases: { tag: UnifiedTag }[],
): boolean {
  const oldestListedRelease = listedReleases[listedReleases.length - 1];

  if (oldestListedRelease === undefined) {
    return true;
  }
  return (
    Date.parse(tag.commitDate) >=
    Date.parse(oldestListedRelease.tag.commitDate)
  );
}

function toOption({ name }: UnifiedTag): SlackOption {
  return { text: { type: 'plain_text', text: name }, value: name };
}

function toOptionGroup(
  text: string,
  options: SlackOption[],
): PreviousReleaseTagOptionGroup | undefined {
  return options.length > 0
    ? { label: { type: 'plain_text', text }, options }
    : undefined;
}
