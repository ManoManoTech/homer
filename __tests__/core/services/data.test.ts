import {
  addReviewToChannel,
  createRelease,
  getProjectReleases,
  updateRelease,
} from '@/core/services/data';
import type { DataRelease } from '@/core/typings/Data';
import { slackUserFixture } from '@root/__tests__/__fixtures__/slackUserFixture';

const makeRelease = (overrides: Partial<DataRelease> = {}): DataRelease => ({
  description: 'test release',
  failedDeployments: [],
  projectId: 1,
  slackAuthor: slackUserFixture,
  startedDeployments: [],
  state: 'created',
  successfulDeployments: [],
  tagName: 'v1.0.0',
  ...overrides,
});

function pushRawReleaseEntry(
  releaseModel: any,
  values: Record<string, unknown>,
) {
  releaseModel.entries.push({
    values,
    toJSON() {
      return this.values;
    },
    async update(newValues: Record<string, unknown>) {
      this.values = { ...this.values, ...newValues };
      return this;
    },
  });
}

describe('data service', () => {
  it('should create a review then update it on subsequent call', async () => {
    const review = {
      channelId: 'C1',
      mergeRequestIid: 42,
      projectId: 1,
      ts: 'ts1',
    };

    await addReviewToChannel(review);
    await addReviewToChannel({ ...review, ts: 'ts2' });

    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(await hasModelEntry('Review', { ...review, ts: 'ts2' })).toBe(true);
  });

  it('should return all releases for a project', async () => {
    await createRelease(makeRelease({ tagName: 'v1.0.0' }));
    await createRelease(makeRelease({ tagName: 'v2.0.0' }));

    const releases = await getProjectReleases(1);

    expect(releases.map((r) => r.tagName)).toEqual(['v1.0.0', 'v2.0.0']);
  });

  it('should throw when updating a non-existent release', async () => {
    await expect(updateRelease(999, 'nonexistent', (r) => r)).rejects.toThrow(
      'Unable to find release nonexistent',
    );
  });

  it('should convert old string array deployment format to structured objects', async () => {
    const { Sequelize: SequelizeMock } = (await import('sequelize')) as any;

    pushRawReleaseEntry(SequelizeMock.models.Release, {
      projectId: 50,
      tagName: 'v-old',
      description: 'old release',
      state: 'created',
      failedDeployments: JSON.stringify(['staging', 'production']),
      slackAuthor: JSON.stringify(slackUserFixture),
      startedDeployments: JSON.stringify([]),
      successfulDeployments: JSON.stringify([]),
    });

    const [release] = await getProjectReleases(50);

    expect(release.failedDeployments).toEqual([
      { environment: 'staging', date: undefined },
      { environment: 'production', date: undefined },
    ]);
  });

  it('should return empty array when deployment field is null', async () => {
    const { Sequelize: SequelizeMock } = (await import('sequelize')) as any;

    pushRawReleaseEntry(SequelizeMock.models.Release, {
      projectId: 70,
      tagName: 'v-null-deploy',
      description: 'release with null deployments',
      state: 'created',
      failedDeployments: null,
      slackAuthor: JSON.stringify(slackUserFixture),
      startedDeployments: JSON.stringify([]),
      successfulDeployments: JSON.stringify([]),
    });

    const [release] = await getProjectReleases(70);

    expect(release.failedDeployments).toEqual([]);
  });

  it('should return empty array when deployment array contains unexpected types', async () => {
    const { Sequelize: SequelizeMock } = (await import('sequelize')) as any;

    pushRawReleaseEntry(SequelizeMock.models.Release, {
      projectId: 80,
      tagName: 'v-unexpected-type',
      description: 'release with unexpected deployment types',
      state: 'created',
      failedDeployments: JSON.stringify([123, 456]),
      slackAuthor: JSON.stringify(slackUserFixture),
      startedDeployments: JSON.stringify([]),
      successfulDeployments: JSON.stringify([]),
    });

    const [release] = await getProjectReleases(80);

    expect(release.failedDeployments).toEqual([]);
  });

  it('should fallback to empty array when deployment JSON is invalid', async () => {
    const { Sequelize: SequelizeMock } = (await import('sequelize')) as any;

    pushRawReleaseEntry(SequelizeMock.models.Release, {
      projectId: 60,
      tagName: 'v-bad',
      description: 'bad release',
      state: 'created',
      failedDeployments: '{invalid json',
      slackAuthor: JSON.stringify(slackUserFixture),
      startedDeployments: JSON.stringify([]),
      successfulDeployments: JSON.stringify([]),
    });

    const [release] = await getProjectReleases(60);

    expect(release.failedDeployments).toEqual([]);
  });
});
