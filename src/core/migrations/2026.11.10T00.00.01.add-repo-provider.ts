import type { Migration } from '@/core/services/migrator';

/**
 * Provider columns by expand and contract (ADR 0003, ManoManoTech/homer#212):
 * nullable columns with a default, so existing rows read back as GitLab and
 * nothing is backfilled.
 *
 * - `repoProvider` on every table.
 * - `repoSlug` (`owner/name`, refreshed from GitHub webhooks) on the tables
 *   that GitHub reviews use.
 * - `projectId` widened to BIGINT: GitHub ids pass the INTEGER maximum around
 *   2028. `Releases` is widened too, as GitHub releases are stored there.
 *
 * Also upgrades databases that ran this branch's earlier migrations, which
 * named the column `provider` and made it NOT NULL.
 */
const TABLES = ['Projects', 'Releases', 'Reviews'];
const TABLES_WITH_SLUG = ['Projects', 'Reviews'];

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const query = (sql: string) =>
      queryInterface.sequelize.query(sql, { transaction });

    for (const table of TABLES) {
      await query(`DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = '${table}' AND column_name = 'provider'
        ) THEN
          ALTER TABLE "${table}" RENAME COLUMN "provider" TO "repoProvider";
        END IF;
      END $$`);
      await query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "repoProvider" VARCHAR(255) DEFAULT 'gitlab'`,
      );
      await query(
        `ALTER TABLE "${table}" ALTER COLUMN "repoProvider" DROP NOT NULL`,
      );
      await query(
        `ALTER TABLE "${table}" ALTER COLUMN "repoProvider" SET DEFAULT 'gitlab'`,
      );
      // Rewrites the table under a lock, which is short as old rows are
      // cleaned after 15 days.
      await query(
        `ALTER TABLE "${table}" ALTER COLUMN "projectId" TYPE BIGINT`,
      );
    }
    for (const table of TABLES_WITH_SLUG) {
      await query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "repoSlug" VARCHAR(255)`,
      );
    }
  });
};

/** Only possible while no project id exceeds the INTEGER maximum. */
export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async (transaction) => {
    for (const table of TABLES_WITH_SLUG) {
      await queryInterface.removeColumn(table, 'repoSlug', { transaction });
    }
    for (const table of TABLES) {
      await queryInterface.removeColumn(table, 'repoProvider', { transaction });
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" ALTER COLUMN "projectId" TYPE INTEGER`,
        { transaction },
      );
    }
  });
};
