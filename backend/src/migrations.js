import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, isDatabaseConfigured } from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(__dirname, '../migrations');

export async function runMigrations({ requireDatabase = false } = {}) {
  if (!isDatabaseConfigured()) {
    if (requireDatabase) {
      throw new Error('DATABASE_URL is required to run migrations.');
    }

    return { skipped: true, applied: [] };
  }

  const pool = getPool();
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));
  const applied = [];

  for (const file of files) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const existing = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [file]);

      if (!existing.rowCount) {
        const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        applied.push(file);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { skipped: false, applied };
}

export function shouldRunMigrationsOnStart(env = process.env) {
  const value = String(env.RUN_MIGRATIONS_ON_START ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(value);
}
