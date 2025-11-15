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
import type { ReleaseDeploymentInfo } from '@/release/typings/ReleaseDeploymentInfo';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CLEAN_INTERVAL_MS = DAY_IN_MS;
const LIFESPAN_WITHOUT_UPDATE_MS = 15 * DAY_IN_MS;

const sequelize = new Sequelize({
  database: CONFIG.postgres.databaseName,
  dialect: 'postgres',
  host: CONFIG.postgres.host,
  logging: (msg) => logger.debug(`[Sequelize] ${msg}`),
  password: CONFIG.postgres.password,
  port: CONFIG.postgres.port,
  username: CONFIG.postgres.username,
});

const Project = sequelize.define<Model<DataProject>>('Project', {
  channelId: { type: DataTypes.STRING, allowNull: false },
  projectId: { type: DataTypes.INTEGER, allowNull: true }, // GitLab numeric ID (null for GitHub)
  projectIdString: { type: DataTypes.STRING, allowNull: true }, // GitHub owner/repo (null for GitLab)
  providerType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'gitlab',
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
  projectId: { type: DataTypes.INTEGER, allowNull: true }, // GitLab numeric ID (null for GitHub)
  projectIdString: { type: DataTypes.STRING, allowNull: true }, // GitHub owner/repo (null for GitLab)
  providerType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'gitlab',
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

export async function connectToDatabase(): Promise<void> {
  await sequelize.sync({ alter: true });
  await cleanOldEntries();
  setInterval(cleanOldEntries, CLEAN_INTERVAL_MS);
}

export async function addProjectToChannel({
  channelId,
  projectId,
  projectIdString,
  providerType,
}: DataProject): Promise<void> {
  await Project.findOrCreate({
    where: {
      channelId,
      projectId: projectId || null,
      projectIdString: projectIdString || null,
      providerType,
    },
  });
}

export async function addReviewToChannel({
  channelId,
  mergeRequestIid,
  projectId,
  projectIdString,
  providerType,
  ts,
}: DataReview): Promise<void> {
  const review = await Review.findOne({
    where: {
      channelId,
      mergeRequestIid,
      projectId: projectId || null,
      projectIdString: projectIdString || null,
      providerType,
    },
  });

  if (review !== null) {
    await review.update({ ts });
  } else {
    await Review.create({
      channelId,
      mergeRequestIid,
      projectId: projectId || null,
      projectIdString: projectIdString || null,
      providerType,
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
  projectId: number | string,
  mergeRequestIid: number,
): Promise<DataReview[]> {
  const where: any = { mergeRequestIid };

  if (typeof projectId === 'number') {
    where.projectId = projectId;
  } else {
    where.projectIdString = projectId;
  }

  const reviews = await Review.findAll({ where });
  return reviews.map(toJSON);
}

export async function getChannelsByProjectId(
  projectId: number | string,
): Promise<DataProject[]> {
  const where: any = {};

  if (typeof projectId === 'number') {
    where.projectId = projectId;
  } else {
    where.projectIdString = projectId;
  }

  const projects = await Project.findAll({ where });
  return projects.map(toJSON);
}

export async function countChannelsByProjectId(
  projectId: number,
): Promise<number> {
  return Project.count({
    where: { projectId },
  });
}

export async function countChannelsByProjectIdString(
  projectIdString: string,
): Promise<number> {
  return Project.count({
    where: { projectIdString },
  });
}

export async function hasRelease(
  projectId: number,
  tagName: string,
): Promise<boolean> {
  return (await getProjectRelease(projectId, tagName)) !== undefined;
}

export async function removeProjectFromChannel(
  projectId: number | string,
  channelId: string,
) {
  const where: any = { channelId };

  if (typeof projectId === 'number') {
    where.projectId = projectId;
  } else {
    where.projectIdString = projectId;
  }

  await Project.destroy({ where });
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
  mergeRequestIid: number,
): Promise<void> {
  await Review.destroy({
    where: { mergeRequestIid },
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
