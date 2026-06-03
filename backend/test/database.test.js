import assert from 'node:assert/strict';
import test from 'node:test';
import { getPostgresSettings, getPublicPostgresStatus } from '../src/database.js';

test('postgres settings detect connection string aliases and ssl modes', () => {
  const settings = getPostgresSettings({
    POSTGRES_URL: 'postgresql://example.invalid/paddockindia?sslmode=require',
  });

  assert.equal(settings.configured, true);
  assert.deepEqual(settings.ssl, { rejectUnauthorized: false });
});

test('public postgres status does not leak connection strings', () => {
  const status = getPublicPostgresStatus({
    DATABASE_URL: 'postgresql://user:secret@example.invalid/paddockindia',
    DATABASE_SSL: 'true',
  });

  assert.deepEqual(status, { configured: true, ssl: true });
  assert.equal(JSON.stringify(status).includes('secret'), false);
});
