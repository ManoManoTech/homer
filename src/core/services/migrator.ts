import path from 'node:path';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from '@/core/services/data';
import { logger } from '@/core/services/logger';

const umzug = new Umzug({
  migrations: {
    glob: path.resolve(__dirname, '../migrations/*.js'),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: {
    info: (msg) => logger.info(msg),
    warn: (msg) => logger.warn(msg),
    error: (msg) => logger.error(msg),
    debug: (msg) => logger.debug(msg),
  },
});

export type Migration = typeof umzug._types.migration;

export async function runMigrations(): Promise<void> {
  const pending = await umzug.pending();
  if (pending.length === 0) {
    logger.info('No pending migrations.');
    return;
  }
  logger.info(`Running ${pending.length} pending migration(s)...`);
  await umzug.up();
  logger.info('All migrations applied successfully.');
}

export { umzug };
