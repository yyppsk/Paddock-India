import pg from 'pg';

const { Pool } = pg;
const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'require', 'required', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'disable', 'disabled', 'off']);
let pool = null;

export function getPostgresSettings(env = process.env) {
  const connectionString =
    env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_CONNECTION_STRING || env.PG_CONNECTION_STRING || '';
  const sslMode = env.DATABASE_SSL || env.PGSSLMODE || '';

  return {
    configured: Boolean(connectionString),
    connectionString,
    ssl: resolveSslMode(sslMode, connectionString),
  };
}

export function getPublicPostgresStatus(env = process.env) {
  const settings = getPostgresSettings(env);

  return {
    configured: settings.configured,
    ssl: Boolean(settings.ssl),
  };
}

export function isDatabaseConfigured(env = process.env) {
  return getPostgresSettings(env).configured;
}

export function getPool() {
  if (pool) {
    return pool;
  }

  const settings = getPostgresSettings();

  if (!settings.configured) {
    throw new Error('DATABASE_URL is required for this operation.');
  }

  pool = new Pool({
    connectionString: settings.connectionString,
    ssl: settings.ssl,
    max: clampInteger(process.env.POSTGRES_POOL_MAX, 2, 20, 8),
    idleTimeoutMillis: clampInteger(process.env.POSTGRES_IDLE_TIMEOUT_MS, 1000, 120000, 30000),
    connectionTimeoutMillis: clampInteger(process.env.POSTGRES_CONNECT_TIMEOUT_MS, 1000, 30000, 10000),
  });

  pool.on('error', (error) => {
    console.error('Unexpected Postgres pool error:', error);
  });

  return pool;
}

export async function query(sql, parameters = []) {
  return getPool().query(sql, parameters);
}

export async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}

function resolveSslMode(sslMode, connectionString) {
  const normalized = String(sslMode).trim().toLowerCase();

  if (DISABLED_VALUES.has(normalized)) {
    return false;
  }

  if (ENABLED_VALUES.has(normalized)) {
    return { rejectUnauthorized: false };
  }

  if (connectionString.includes('sslmode=require')) {
    return { rejectUnauthorized: false };
  }

  return false;
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value || '', 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}
