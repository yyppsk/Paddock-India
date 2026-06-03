import { closePool } from './database.js';
import { runMigrations } from './migrations.js';

try {
  const result = await runMigrations({ requireDatabase: true });
  console.log(`Migrations complete. Applied: ${result.applied.length ? result.applied.join(', ') : 'none'}`);
} finally {
  await closePool();
}
