import {
  DataTypes,
  type Model,
  Op,
  Sequelize,
  type WhereOptions,
} from 'sequelize';
import { CONFIG } from '@/config';
import { logger } from '@/core/services/logger';
import type {
  DatabaseEntry,
  DataProject,
  DataRelease,
  DataReleaseInternal,
  DataReview,
} from '@/core/typings/Data';
import { DEFAULT_PROVIDER, type ProviderType } from '@/core/typings/Provider';
import type { ReleaseDeploymentInfo } from '@/release/typings/ReleaseDeploymentInfo';

/** Data created before GitHub support has no provider: it is GitLab. */
type WithOptionalProvider<T extends { provider: ProviderType }> = Omit<
  T,
  'provider'
> & { provider?: ProviderType };

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CLEAN_INTERVAL_MS = DAY_IN_MS;
const LIFESPAN_WITHOUT_UPDATE_MS = 15 * DAY_IN_MS;

export const sequelize = new Sequelize({
  database: CONFIG.postgres.databaseName,
  dialect: 'postgres',
  host: CONFIG.postgres.host,
  logging: (msg) => logger.debug(`[Sequelize] ${msg}`),
  password: CONFIG.postgres.password,
  pool: CONFIG.postgres.pool,
  port: CONFIG.postgres.port,
  username: CONFIG.postgres.username,
});

const Project = sequelize.define<Model<DataProject>>('Project', {
  channelId: { type: DataTypes.STRING, allowNull: false },
  projectId: { type: DataTypes.INTEGER, allowNull: false },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: DEFAULT_PROVIDER,
  },
});

const Release = sequelize.define<Model<DataReleaseInternal>>('Release', {
  description: { type: DataTypes.TEXT, allowNull: true }, // TODO change this when possible
  failedDeployments: { type: DataTypes.TEXT, allowNull: false },
  projectId: { type: DataTypes.INTEGER, allowNull: false },
  slackAuthor: { type: DataTypes.TEXT, allowNull: false },
  startedDeployments: { type: DataTypes.TEXT, allowNull: false },
  state: { type: DataTypes.STRING, allowNull: false },
  successfulDeployments: { type: DataTypes.TEXT, allowNull: false },
  tagName: { type: DataTypes.STRING, allowNull: false },
  ts: { type: DataTypes.STRING, allowNull: true },
});

const Review = sequelize.define<Model<DataReview>>('Review', {
  channelId: { type: DataTypes.STRING, allowNull: false },
  mergeRequestIid: { type: DataTypes.INTEGER, allowNull: false },
  projectId: { type: DataTypes.INTEGER, allowNull: false },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: DEFAULT_PROVIDER,
  },
  ts: { type: DataTypes.STRING, allowNull: false },
});

export async function cleanOldEntries(): Promise<void> {
  const cleanedReviewsCount = await Review.destroy({
    where: {
      updatedAt: {
        [Op.lt]: new Date(Date.now() - LIFESPAN_WITHOUT_UPDATE_MS),
      },
    } as any, // Typing issue in sequelize
  });
  logger.info(`Cleaned ${cleanedReviewsCount} reviews.`);

  const cleanedReleasesCount = await Release.destroy({
    where: {
      updatedAt: {
        [Op.lt]: new Date(Date.now() - LIFESPAN_WITHOUT_UPDATE_MS),
      },
    } as any, // Typing issue in sequelize
  });
  logger.info(`Cleaned ${cleanedReleasesCount} releases.`);
}

export async function cleanReleases(
  filter: WhereOptions<DataReleaseInternal>,
): Promise<void> {
  await Release.destroy({ where: filter });
}

let cleanupInterval: ReturnType<typeof setInterval> | undefined;

export async function connectToDatabase(): Promise<void> {
  await sequelize.authenticate();
  if (process.env.NODE_ENV === 'production') {
    const { runMigrations } = await import('./migrator');
    await runMigrations();
  } else {
    await sequelize.sync({ alter: true });
  }
  await cleanOldEntries();
  cleanupInterval = setInterval(cleanOldEntries, CLEAN_INTERVAL_MS);
}

export async function disconnectFromDatabase(): Promise<void> {
  if (cleanupInterval !== undefined) {
    clearInterval(cleanupInterval);
    cleanupInterval = undefined;
  }
  await sequelize.close();
}

export async function checkDatabaseConnection(): Promise<void> {
  await sequelize.authenticate();
}

export async function addProjectToChannel({
  channelId,
  projectId,
  provider = DEFAULT_PROVIDER,
}: WithOptionalProvider<DataProject>): Promise<void> {
  await Project.findOrCreate({
    where: { channelId, projectId, provider },
  });
}

export async function addReviewToChannel({
  channelId,
  mergeRequestIid,
  projectId,
  provider = DEFAULT_PROVIDER,
  ts,
}: WithOptionalProvider<DataReview>): Promise<void> {
  const review = await Review.findOne({
    where: { channelId, mergeRequestIid, projectId, provider },
  });

  if (review !== null) {
    await review.update({ ts });
  } else {
    await Review.create({
      channelId,
      mergeRequestIid,
      projectId,
      provider,
      ts,
    });
  }
}

export async function createRelease(
  release: DataRelease,
): Promise<DataRelease> {
  const [releaseModel] = await Release.findOrCreate({
    where: {
      projectId: release.projectId,
      tagName: release.tagName,
      description: release.description,
      state: release.state,
      failedDeployments: JSON.stringify(release.failedDeployments),
      slackAuthor: JSON.stringify(release.slackAuthor),
      startedDeployments: JSON.stringify(release.startedDeployments),
      successfulDeployments: JSON.stringify(release.successfulDeployments),
    },
  });
  return formatRelease(releaseModel);
}

export async function getProjectRelease(
  projectId: number,
  tagName: string,
): Promise<DataRelease | undefined> {
  const releaseModel = await Release.findOne({
    where: { projectId, tagName },
  });
  if (!releaseModel) {
    return undefined;
  }
  return formatRelease(releaseModel);
}

export async function getProjectReleases(
  projectId: number,
): Promise<DataRelease[]> {
  return (
    await Release.findAll({
      where: { projectId },
    })
  ).map(formatRelease);
}

export async function getProjectsByChannelId(
  channelId: string,
): Promise<DataProject[]> {
  const projects = await Project.findAll({
    where: { channelId },
  });
  return projects.map(toJSON);
}

export async function getReleases(
  filter?: WhereOptions<DataReleaseInternal>,
): Promise<DataRelease[]> {
  return (
    await Release.findAll({ order: [['createdAt', 'DESC']], where: filter })
  ).map(formatRelease);
}

export async function getReviewsByChannelId(
  channelId: string,
): Promise<DataReview[]> {
  const reviews = await Review.findAll({
    where: { channelId },
  });
  return reviews.map(toJSON);
}

export async function getReviewsByMergeRequestIid(
  projectId: number,
  mergeRequestIid: number,
  provider: ProviderType,
): Promise<DataReview[]> {
  const reviews = await Review.findAll({
    where: { mergeRequestIid, projectId, provider },
  });
  return reviews.map(toJSON);
}

export async function getChannelsByProjectId(
  projectId: number,
  provider: ProviderType,
): Promise<DataProject[]> {
  const projects = await Project.findAll({
    where: { projectId, provider },
  });
  return projects.map(toJSON);
}

export async function countChannelsByProjectId(
  projectId: number,
  provider: ProviderType,
): Promise<number> {
  return Project.count({
    where: { projectId, provider },
  });
}

export async function hasRelease(
  projectId: number,
  tagName: string,
): Promise<boolean> {
  return (await getProjectRelease(projectId, tagName)) !== undefined;
}

export async function removeProjectFromChannel(
  projectId: number,
  channelId: string,
  provider: ProviderType,
) {
  await Project.destroy({
    where: { channelId, projectId, provider },
  });
}

export async function removeRelease(
  projectId: number,
  tagName: string,
): Promise<void> {
  await Release.destroy({
    where: { projectId, tagName },
  });
}

export async function removeReview(ts: string): Promise<void> {
  await Review.destroy({
    where: { ts },
  });
}

export async function removeReviewsByMergeRequestIid(
  projectId: number,
  mergeRequestIid: number,
  provider: ProviderType,
): Promise<void> {
  await Review.destroy({
    where: { mergeRequestIid, projectId, provider },
  });
}

export async function updateRelease(
  projectId: number,
  tagName: string,
  updatedReleaseDataGetter: (release: DataRelease) => Partial<DataRelease>,
): Promise<DataRelease> {
  // The transaction prevents race conditions when multiple calls to updateRelease are made at the
  // same time.
  return sequelize.transaction(async (transaction) => {
    const releaseModel = await Release.findOne({
      where: { projectId, tagName },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (releaseModel === null) {
      throw new Error(`Unable to find release ${tagName}`);
    }
    const release = formatRelease(releaseModel);
    const updatedReleaseData = updatedReleaseDataGetter(release);

    return formatRelease(
      await releaseModel.update(
        {
          ...release,
          ...updatedReleaseData,
          failedDeployments: JSON.stringify(
            updatedReleaseData.failedDeployments ?? release.failedDeployments,
          ),
          startedDeployments: JSON.stringify(
            updatedReleaseData.startedDeployments ?? release.startedDeployments,
          ),
          slackAuthor: JSON.stringify(
            updatedReleaseData.slackAuthor ?? release.slackAuthor,
          ),
          successfulDeployments: JSON.stringify(
            updatedReleaseData.successfulDeployments ??
              release.successfulDeployments,
          ),
        },
        { transaction },
      ),
    );
  });
}

function formatRelease(releaseModel: Model<DataReleaseInternal>): DataRelease {
  const internalRelease = toJSON(releaseModel);

  return {
    ...internalRelease,
    failedDeployments: getReleaseDeployments(internalRelease.failedDeployments),
    slackAuthor: JSON.parse(internalRelease.slackAuthor),
    startedDeployments: getReleaseDeployments(
      internalRelease.startedDeployments,
    ),
    successfulDeployments: getReleaseDeployments(
      internalRelease.successfulDeployments,
    ),
  };
}

function toJSON<DataType extends object>(
  model: Model<DataType>,
): DatabaseEntry<DataType> {
  return model.toJSON();
}

function getReleaseDeployments(
  dbTextValue: string | null,
): ReleaseDeploymentInfo[] {
  if (!dbTextValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(dbTextValue);

    if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
      return [];
    }

    const firstElement = parsedValue[0];

    if (typeof firstElement === 'string') {
      // --- OLD FORMAT: ["staging", "production"] ---
      // Transform it on the fly into the new structure
      return parsedValue.map((env: string) => ({
        environment: env,
        date: undefined,
      }));
    } else if (typeof firstElement === 'object' && firstElement !== null) {
      // --- NEW FORMAT: [{"environment": "staging", ...}] ---
      return parsedValue as ReleaseDeploymentInfo[];
    }

    return [];
  } catch (error) {
    logger.error(
      `Failed to parse deployment JSON from TEXT column: ${dbTextValue} ${error}`,
    );
    return [];
  }
}
