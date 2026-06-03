import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { listMigrationStatus } from '../src/migrations.js';

test('auth and content migration creates required tables and preserves seeded content edits', async () => {
  const sql = await readFile(resolve('backend/migrations/001_auth_content.sql'), 'utf8');

  for (const table of [
    'users',
    'user_sessions',
    'password_reset_tokens',
    'email_verification_tokens',
    'content_sections',
    'schema_migrations',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }

  assert.match(sql, /CHECK \(role IN \('user', 'content_manager', 'super_admin'\)\)/);
  assert.match(sql, /ON CONFLICT \(slug\) DO NOTHING/);
  assert.doesNotMatch(sql, /ON CONFLICT \(slug\) DO UPDATE/);
});

test('home and grid refresh migration only updates old seeded rows', async () => {
  const sql = await readFile(resolve('backend/migrations/002_home_grid_refresh.sql'), 'utf8');

  assert.match(sql, /WHERE slug = 'home'\s+AND title = 'Spa Track'/);
  assert.match(sql, /WHERE slug = 'grid'\s+AND title = 'Lights Out'/);
  assert.match(sql, /Paddock India/);
  assert.match(sql, /Assetto Corsa/);
  assert.match(sql, /Need for Speed/);
  assert.match(sql, /assetto-corsa\.webp/);
  assert.match(sql, /need-for-speed-unbound\.webp/);
});

test('game poster migration enriches existing grid settings only', async () => {
  const sql = await readFile(resolve('backend/migrations/003_game_poster_assets.sql'), 'utf8');

  assert.match(sql, /WHERE slug = 'grid'/);
  assert.match(sql, /jsonb_set/);
  assert.match(sql, /asseto-corsa/);
  assert.match(sql, /nfs-server/);
  assert.match(sql, /assetto-corsa\.webp/);
  assert.match(sql, /need-for-speed-unbound\.webp/);
});

test('grid copy refresh migration updates existing grid title and game label', async () => {
  const sql = await readFile(resolve('backend/migrations/004_grid_copy_refresh.sql'), 'utf8');

  assert.match(sql, /Gaming Titles/);
  assert.match(sql, /well-organized events/);
  assert.match(sql, /Need for Speed/);
  assert.match(sql, /WHERE slug = 'grid'/);
  assert.match(sql, /NFS Server/);
});

test('migration status can list local migration files without a database', async () => {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    POSTGRES_CONNECTION_STRING: process.env.POSTGRES_CONNECTION_STRING,
    PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
  };

  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_CONNECTION_STRING;
  delete process.env.PG_CONNECTION_STRING;

  try {
    const status = await listMigrationStatus();

    assert.equal(status.skipped, true);
    assert.equal(status.appliedCount, 0);
    assert.equal(status.pendingCount, status.total);
    assert.ok(status.migrations.some((migration) => migration.version === '001_auth_content.sql'));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
