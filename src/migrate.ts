import 'source-map-support/register';
import * as tsconfigPaths from 'tsconfig-paths';
import { compilerOptions } from '../tsconfig.json';

tsconfigPaths.register({
  baseUrl: compilerOptions.outDir,
  paths: compilerOptions.paths,
});

async function main() {
  const { umzug } = await import('@/core/services/migrator');
  const command = process.argv[2];

  switch (command) {
    case 'up':
      await umzug.up();
      console.log('Migrations applied successfully.');
      break;
    case 'down':
      await umzug.down();
      console.log('Last migration reverted.');
      break;
    case 'status': {
      const pending = await umzug.pending();
      const executed = await umzug.executed();
      console.log(
        'Executed migrations:',
        executed.map((m) => m.name),
      );
      console.log(
        'Pending migrations:',
        pending.map((m) => m.name),
      );
      break;
    }
    default:
      console.log('Usage: node dist/src/migrate.js <up|down|status>');
      process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
