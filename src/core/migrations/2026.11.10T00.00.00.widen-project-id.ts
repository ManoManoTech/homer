import type { Migration } from '@/core/services/migrator';

const TABLES = ['Projects', 'Releases', 'Reviews'];

/**
 * GitHub repository ids pass the INTEGER maximum (2,147,483,647) around 2028.
 * Widening rewrites the tables under a lock, which is short as old rows are
 * cleaned after 15 days.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    for (const table of TABLES) {
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "projectId" TYPE BIGINT`,
        { transaction },
      );
    }
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    for (const table of TABLES) {
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "projectId" TYPE INTEGER`,
        { transaction },
      );
    }
  });
};
