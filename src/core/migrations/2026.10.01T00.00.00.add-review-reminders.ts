import type { Migration } from '@/core/services/migrator';

/**
 * Creates the table holding the schedule of `/homer review reminder`, one row
 * per channel. Idempotent so it is safe on databases where the table was
 * already created by sequelize.sync().
 *
 * The unique index lives here rather than on the model: sequelize.sync() with
 * `alter: true` adds a new unique constraint on every run.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS "ReviewReminders" (
        "id" SERIAL PRIMARY KEY,
        "channelId" VARCHAR(255) NOT NULL,
        "days" VARCHAR(255) NOT NULL,
        "failedAttempts" INTEGER NOT NULL DEFAULT 0,
        "lastSentOn" VARCHAR(255),
        "time" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      )`,
      { transaction },
    );

    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ReviewReminders_channelId_unique" ON "ReviewReminders" ("channelId")`,
      { transaction },
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('ReviewReminders');
};
