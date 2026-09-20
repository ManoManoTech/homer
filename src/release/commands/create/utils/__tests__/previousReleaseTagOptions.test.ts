import type { GitlabRelease } from '@/core/typings/GitlabRelease';
import type { GitlabTag } from '@/core/typings/GitlabTag';
import {
  buildPreviousReleaseTagOptionGroups,
  MANUAL_TAGS_GROUP_LABEL,
  NOT_DEPLOYED_GROUP_LABEL,
  NOT_DEPLOYED_RELEASE_NAME_PREFIX,
  RELEASES_GROUP_LABEL,
} from '../previousReleaseTagOptions';

function tag(name: string, commitDate: string): GitlabTag {
  return {
    name,
    commit: { created_at: commitDate },
  } as unknown as GitlabTag;
}

function release(
  tagName: string,
  releasedAt: string,
  { notDeployed = false } = {},
): GitlabRelease {
  return {
    tag_name: tagName,
    name: notDeployed
      ? `${NOT_DEPLOYED_RELEASE_NAME_PREFIX}${tagName}`
      : tagName,
    released_at: releasedAt,
  } as unknown as GitlabRelease;
}

function groupNamed(
  groups: ReturnType<
    typeof buildPreviousReleaseTagOptionGroups
  >['optionGroups'],
  label: string,
) {
  return groups.find((group) => group.label.text === label);
}

function valuesOf(
  groups: ReturnType<
    typeof buildPreviousReleaseTagOptionGroups
  >['optionGroups'],
  label: string,
) {
  return groupNamed(groups, label)?.options.map(({ value }) => value);
}

describe('buildPreviousReleaseTagOptionGroups', () => {
  it('orders releases by release date when their tagged commit is identical', () => {
    // The bug: GitLab orders /repository/tags by the tagged commit's date, so
    // tags sharing a commit come back in an order unrelated to release time.
    const sharedCommit = '2026-09-04T13:42:25.000+00:00';
    const tags = [
      tag('stable-20260904-1542', sharedCommit),
      tag('stable-20260918-2242', sharedCommit),
      tag('stable-20260918-2243', sharedCommit),
    ];
    const releases = [
      release('stable-20260904-1542', '2026-09-04T13:45:00.000Z'),
      release('stable-20260918-2242', '2026-09-18T20:42:35.159Z'),
      release('stable-20260918-2243', '2026-09-18T20:44:11.413Z'),
    ];

    const { optionGroups } = buildPreviousReleaseTagOptionGroups(
      tags,
      releases,
    );

    expect(valuesOf(optionGroups, RELEASES_GROUP_LABEL)).toEqual([
      'stable-20260918-2243',
      'stable-20260918-2242',
      'stable-20260904-1542',
    ]);
  });

  it('defaults to the most recent deployed release', () => {
    const tags = [
      tag('stable-20260918-2243', '2026-09-04T13:42:25.000+00:00'),
      tag('stable-20260904-1542', '2026-09-04T13:42:25.000+00:00'),
    ];
    const releases = [
      release('stable-20260904-1542', '2026-09-04T13:45:00.000Z'),
      release('stable-20260918-2243', '2026-09-18T20:44:11.413Z'),
    ];

    const { defaultOption } = buildPreviousReleaseTagOptionGroups(
      tags,
      releases,
    );

    expect(defaultOption?.value).toEqual('stable-20260918-2243');
  });

  it('keeps at most 5 releases', () => {
    const tags = Array.from({ length: 8 }, (_, i) =>
      tag(`stable-2026090${i}-1000`, '2026-09-04T13:42:25.000+00:00'),
    );
    const releases = Array.from({ length: 8 }, (_, i) =>
      release(`stable-2026090${i}-1000`, `2026-09-0${i + 1}T10:00:00.000Z`),
    );

    const { optionGroups } = buildPreviousReleaseTagOptionGroups(
      tags,
      releases,
    );

    expect(valuesOf(optionGroups, RELEASES_GROUP_LABEL)).toHaveLength(5);
  });

  it('moves releases marked as not deployed into their own group', () => {
    const tags = [
      tag('stable-20260918-2243', '2026-09-04T13:42:25.000+00:00'),
      tag('stable-20260918-2242', '2026-09-04T13:42:25.000+00:00'),
    ];
    const releases = [
      release('stable-20260918-2243', '2026-09-18T20:44:11.413Z'),
      release('stable-20260918-2242', '2026-09-18T20:42:35.159Z', {
        notDeployed: true,
      }),
    ];

    const { optionGroups, defaultOption } = buildPreviousReleaseTagOptionGroups(
      tags,
      releases,
    );

    expect(valuesOf(optionGroups, RELEASES_GROUP_LABEL)).toEqual([
      'stable-20260918-2243',
    ]);
    expect(valuesOf(optionGroups, NOT_DEPLOYED_GROUP_LABEL)).toEqual([
      'stable-20260918-2242',
    ]);
    expect(defaultOption?.value).toEqual('stable-20260918-2243');
  });

  it('keeps at most 2 not deployed releases', () => {
    const tags = Array.from({ length: 4 }, (_, i) =>
      tag(`stable-2026090${i}-1000`, '2026-09-04T13:42:25.000+00:00'),
    );
    const releases = Array.from({ length: 4 }, (_, i) =>
      release(`stable-2026090${i}-1000`, `2026-09-0${i + 1}T10:00:00.000Z`, {
        notDeployed: true,
      }),
    );

    const { optionGroups } = buildPreviousReleaseTagOptionGroups(
      tags,
      releases,
    );

    expect(valuesOf(optionGroups, NOT_DEPLOYED_GROUP_LABEL)).toHaveLength(2);
  });

  it('lists tags without a release as manual tags', () => {
    const tags = [
      tag('stable-20260918-2142', '2026-09-18T21:18:23.000+02:00'),
      tag('stable-20260917-1000', '2026-09-18T21:18:23.000+02:00'),
    ];
    const releases = [
      release('stable-20260918-2142', '2026-09-18T19:42:20.666Z'),
    ];

    const { optionGroups } = buildPreviousReleaseTagOptionGroups(
      tags,
      releases,
    );

    expect(valuesOf(optionGroups, RELEASES_GROUP_LABEL)).toEqual([
      'stable-20260918-2142',
    ]);
    expect(valuesOf(optionGroups, MANUAL_TAGS_GROUP_LABEL)).toEqual([
      'stable-20260917-1000',
    ]);
  });

  it('excludes manual tags older than the oldest listed release', () => {
    const tags = [
      tag('stable-20260918-2243', '2026-09-18T20:00:00.000Z'),
      tag('manual-recent', '2026-09-18T21:00:00.000Z'),
      tag('manual-ancient', '2026-01-01T10:00:00.000Z'),
    ];
    const releases = [
      release('stable-20260918-2243', '2026-09-18T20:44:11.413Z'),
    ];

    const { optionGroups } = buildPreviousReleaseTagOptionGroups(
      tags,
      releases,
    );

    expect(valuesOf(optionGroups, MANUAL_TAGS_GROUP_LABEL)).toEqual([
      'manual-recent',
    ]);
  });

  it('orders manual tags sharing a commit by name, most recent first', () => {
    const sharedCommit = '2026-09-18T21:18:23.000+02:00';
    const tags = [
      tag('stable-20260917-1000', sharedCommit),
      tag('stable-20260917-1200', sharedCommit),
      tag('stable-20260917-1100', sharedCommit),
    ];

    const { optionGroups } = buildPreviousReleaseTagOptionGroups(tags, []);

    expect(valuesOf(optionGroups, MANUAL_TAGS_GROUP_LABEL)).toEqual([
      'stable-20260917-1200',
      'stable-20260917-1100',
      'stable-20260917-1000',
    ]);
  });

  it('keeps at most 3 manual tags', () => {
    const tags = Array.from({ length: 5 }, (_, i) =>
      tag(`manual-${i}`, '2026-09-18T21:00:00.000Z'),
    );

    const { optionGroups } = buildPreviousReleaseTagOptionGroups(tags, []);

    expect(valuesOf(optionGroups, MANUAL_TAGS_GROUP_LABEL)).toHaveLength(3);
  });

  it('omits empty groups', () => {
    const tags = [tag('stable-20260918-2243', '2026-09-18T20:00:00.000Z')];
    const releases = [
      release('stable-20260918-2243', '2026-09-18T20:44:11.413Z'),
    ];

    const { optionGroups } = buildPreviousReleaseTagOptionGroups(
      tags,
      releases,
    );

    expect(optionGroups.map(({ label }) => label.text)).toEqual([
      RELEASES_GROUP_LABEL,
    ]);
  });

  it('returns no default when there is no tag at all', () => {
    const { optionGroups, defaultOption } = buildPreviousReleaseTagOptionGroups(
      [],
      [],
    );

    expect(optionGroups).toEqual([]);
    expect(defaultOption).toBeUndefined();
  });
});
