import type { Migration } from '@/core/services/migrator';

/** Releases can come from GitLab or GitHub; existing rows are GitLab ones. */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(
    `ALTER TABLE "Releases" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(255) NOT NULL DEFAULT 'gitlab'`,
  );
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('Releases', 'provider');
};
