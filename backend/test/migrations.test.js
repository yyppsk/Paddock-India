import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

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
