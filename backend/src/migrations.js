import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, isDatabaseConfigured } from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(__dirname, '../migrations');
const CREATE_MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;
const MIGRATION_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext('paddockindia_schema_migrations'))";

export async function runMigrations({ requireDatabase = false } = {}) {
  if (!isDatabaseConfigured()) {
    if (requireDatabase) {
      throw new Error('DATABASE_URL is required to run migrations.');
    }

    return { skipped: true, applied: [] };
  }

  const pool = getPool();
  const files = await getMigrationFiles();
  const applied = [];

  for (const file of files) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(MIGRATION_LOCK_SQL);
      await client.query(CREATE_MIGRATION_TABLE_SQL);

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

export async function listMigrationStatus({ requireDatabase = false } = {}) {
  const files = await getMigrationFiles();

  if (!isDatabaseConfigured()) {
    if (requireDatabase) {
      throw new Error('DATABASE_URL is required to inspect migrations.');
    }

    return createMigrationStatus({ skipped: true, files, rows: [] });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const tableResult = await client.query("SELECT to_regclass('public.schema_migrations') AS table_name");
    const hasMigrationTable = Boolean(tableResult.rows[0]?.table_name);

    if (!hasMigrationTable) {
      return createMigrationStatus({ skipped: false, files, rows: [] });
    }

    const result = await client.query(`
      SELECT version, applied_at
      FROM schema_migrations
      ORDER BY applied_at DESC, version ASC
    `);

    return createMigrationStatus({ skipped: false, files, rows: result.rows });
  } finally {
    client.release();
  }
}

export function shouldRunMigrationsOnStart(env = process.env) {
  const value = String(env.RUN_MIGRATIONS_ON_START ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(value);
}

async function getMigrationFiles() {
  return (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));
}

function createMigrationStatus({ skipped, files, rows }) {
  const appliedByVersion = new Map(
    rows.map((row) => [
      row.version,
      {
        version: row.version,
        appliedAt: row.applied_at instanceof Date ? row.applied_at.toISOString() : row.applied_at || null,
      },
    ]),
  );
  const migrations = files.map((file, index) => {
    const applied = appliedByVersion.get(file);

    return {
      version: file,
      order: index + 1,
      status: applied ? 'applied' : 'pending',
      appliedAt: applied?.appliedAt || null,
    };
  });
  const applied = migrations.filter((migration) => migration.status === 'applied');
  const pending = migrations.filter((migration) => migration.status === 'pending');
  const fileSet = new Set(files);
  const appliedHistory = rows.map((row) => ({
    version: row.version,
    order: fileSet.has(row.version) ? files.indexOf(row.version) + 1 : null,
    status: fileSet.has(row.version) ? 'applied' : 'archived',
    appliedAt: row.applied_at instanceof Date ? row.applied_at.toISOString() : row.applied_at || null,
  }));

  return {
    skipped,
    total: migrations.length,
    appliedCount: applied.length,
    pendingCount: pending.length,
    lastAppliedAt: appliedHistory[0]?.appliedAt || null,
    migrations,
    appliedHistory,
    pending,
  };
}
