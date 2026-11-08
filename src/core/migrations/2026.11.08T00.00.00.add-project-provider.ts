import type { Migration } from '@/core/services/migrator';

/**
 * Projects and reviews can come from GitLab or GitHub. Existing rows are
 * GitLab ones. Idempotent like the initial schema.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    for (const table of ['Projects', 'Reviews']) {
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(255) NOT NULL DEFAULT 'gitlab'`,
        { transaction },
      );
    }
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('Reviews', 'provider', { transaction });
    await queryInterface.removeColumn('Projects', 'provider', { transaction });
  });
};
