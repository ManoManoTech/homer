import type { Migration } from '@/core/services/migrator';

/**
 * Initial schema migration — idempotent so it is safe on databases
 * that were previously managed by sequelize.sync().
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS "Projects" (
        "id" SERIAL PRIMARY KEY,
        "channelId" VARCHAR(255) NOT NULL,
        "projectId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      )`,
      { transaction },
    );

    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS "Releases" (
        "id" SERIAL PRIMARY KEY,
        "description" TEXT,
        "failedDeployments" TEXT NOT NULL,
        "projectId" INTEGER NOT NULL,
        "slackAuthor" TEXT NOT NULL,
        "startedDeployments" TEXT NOT NULL,
        "state" VARCHAR(255) NOT NULL,
        "successfulDeployments" TEXT NOT NULL,
        "tagName" VARCHAR(255) NOT NULL,
        "ts" VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      )`,
      { transaction },
    );

    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS "Reviews" (
        "id" SERIAL PRIMARY KEY,
        "channelId" VARCHAR(255) NOT NULL,
        "mergeRequestIid" INTEGER NOT NULL,
        "projectId" INTEGER NOT NULL,
        "ts" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      )`,
      { transaction },
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('Reviews', { transaction });
    await queryInterface.dropTable('Releases', { transaction });
    await queryInterface.dropTable('Projects', { transaction });
  });
};
