import { DataTypes, Op, Sequelize, type Model } from 'sequelize';
import { logger } from '@/core/services/logger';
import type {
  DatabaseEntry,
  DataProject,
  DataReview,
} from '@/core/typings/Data';
import { getEnvVariable } from '@/core/utils/getEnvVariable';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CLEAN_INTERVAL_MS = DAY_IN_MS;
const REVIEW_LIFESPAN_WITHOUT_UPDATE_MS = 15 * DAY_IN_MS;

const sequelize = new Sequelize({
  database: 'homer',
  dialect: 'postgres',
  host: getEnvVariable('POSTGRES_HOST'),
  logging: (msg) => logger.debug(`[Sequelize] ${msg}`),
  password: getEnvVariable('POSTGRES_PASSWORD'),
  port: Number(getEnvVariable('POSTGRES_PORT')),
  username: getEnvVariable('POSTGRES_USER'),
});

const Project = sequelize.define<Model<DataProject>>('Project', {
  channelId: { type: DataTypes.STRING, allowNull: false },
  projectId: { type: DataTypes.INTEGER, allowNull: false },
});

const Review = sequelize.define<Model<DataReview>>('Review', {
  channelId: { type: DataTypes.STRING, allowNull: false },
  mergeRequestIid: { type: DataTypes.INTEGER, allowNull: false },
  projectId: { type: DataTypes.INTEGER, allowNull: false },
  ts: { type: DataTypes.STRING, allowNull: false },
});

export async function cleanOldEntries(): Promise<void> {
  const cleanedReviewsCount = await Review.destroy({
    where: {
      updatedAt: {
        [Op.lt]: new Date(Date.now() - REVIEW_LIFESPAN_WITHOUT_UPDATE_MS),
      },
    } as any, // Typing issue in sequelize
  });
  logger.info(`Cleaned ${cleanedReviewsCount} reviews.`);
}

export async function connectToDatabase(): Promise<void> {
  await sequelize.sync({ alter: true });
  await cleanOldEntries();
  setInterval(cleanOldEntries, CLEAN_INTERVAL_MS);
}

export async function addProjectToChannel({
  channelId,
  projectId,
}: DataProject): Promise<void> {
  await Project.findOrCreate({
    where: { channelId, projectId },
  });
}

// Useless change
export async function addReviewToChannel({
  channelId,
  mergeRequestIid,
  projectId,
  ts,
}: DataReview): Promise<void> {
  const review = await Review.findOne({
    where: { channelId, mergeRequestIid, projectId },
  });

  if (review !== null) {
    await review.update({ ts });
  } else {
    await Review.create({ channelId, mergeRequestIid, projectId, ts });
  }
}

export async function getProjects(): Promise<DataProject[]> {
  return (await Project.findAll({ order: [['createdAt', 'DESC']] })).map(
    toJSON
  );
}

export async function getProjectsByChannelId(
  channelId: string
): Promise<DataProject[]> {
  const projects = await Project.findAll({
    where: { channelId },
  });
  return projects.map(toJSON);
}

export async function getReviews(): Promise<DataReview[]> {
  return (await Review.findAll({ order: [['createdAt', 'DESC']] })).map(toJSON);
}

export async function getReviewsByChannelId(
  channelId: string
): Promise<DataReview[]> {
  const reviews = await Review.findAll({
    where: { channelId },
  });
  return reviews.map(toJSON);
}

export async function getReviewsByMergeRequestIid(
  projectId: number,
  mergeRequestIid: number
): Promise<DataReview[]> {
  const reviews = await Review.findAll({
    where: { mergeRequestIid, projectId },
  });
  return reviews.map(toJSON);
}

export async function removeProjectFromChannel(
  projectId: number,
  channelId: string
) {
  await Project.destroy({
    where: { channelId, projectId },
  });
}

export async function removeReview(ts: string): Promise<void> {
  await Review.destroy({
    where: { ts },
  });
}

export async function removeReviewsByMergeRequestIid(
  mergeRequestIid: number
): Promise<void> {
  await Review.destroy({
    where: { mergeRequestIid },
  });
}

function toJSON<DataType extends object>(
  model: Model<DataType>
): DatabaseEntry<DataType> {
  return model.toJSON();
}
