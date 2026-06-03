import { isDatabaseConfigured, query, withTransaction } from './database.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from './email.js';
import { clearCookie, createHttpError, getClientIp, getRequestBaseUrl, parseCookies, setCookie } from './http.js';
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  isAdminRole,
  isValidEmail,
  normalizeEmail,
  parseCsvSet,
  sanitizeDisplayName,
  validatePassword,
  verifyPassword,
} from './security.js';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'paddockindia_session';
const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME || 'paddockindia_csrf';
const SESSION_DAYS = clampInteger(process.env.SESSION_DAYS, 1, 90, 14);
const RESET_TOKEN_MINUTES = clampInteger(process.env.RESET_TOKEN_MINUTES, 10, 180, 45);
const VERIFY_TOKEN_HOURS = clampInteger(process.env.VERIFY_TOKEN_HOURS, 1, 168, 48);
const ADMIN_ROLES = new Set(['content_manager', 'super_admin']);
const ALL_ROLES = new Set(['user', 'content_manager', 'super_admin']);

export async function signup({ payload, request, response }) {
  ensureDatabase();
  const email = normalizeEmail(payload.email);
  const displayName = sanitizeDisplayName(payload.displayName || payload.display_name);
  const passwordError = validatePassword(payload.password);

  if (!isValidEmail(email)) {
    throw createHttpError(400, 'invalid_email');
  }

  if (passwordError) {
    throw createHttpError(400, 'weak_password', passwordError);
  }

  const role = getInitialRole(email);
  const passwordHash = await hashPassword(payload.password);
  const verificationToken = createOpaqueToken();

  const user = await withTransaction(async (client) => {
    const existing = await client.query('SELECT id FROM users WHERE email_normalized = $1', [email]);

    if (existing.rowCount) {
      throw createHttpError(409, 'email_already_registered');
    }

    const userResult = await client.query(
      `
        INSERT INTO users (email, email_normalized, display_name, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, display_name, role, status, email_verified, created_at
      `,
      [payload.email.trim(), email, displayName, passwordHash, role],
    );

    await client.query(
      `
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, now() + ($3 || ' hours')::interval)
      `,
      [userResult.rows[0].id, hashToken(verificationToken), VERIFY_TOKEN_HOURS],
    );

    return userResult.rows[0];
  });

  await createSession({ user, request, response });
  await sendEmailSafely(() =>
    sendWelcomeEmail({
      to: user.email,
      displayName: user.display_name,
      verificationToken,
      origin: getRequestBaseUrl(request),
    }),
  );

  return { user: serializeUser(user) };
}

export async function login({ payload, request, response }) {
  ensureDatabase();
  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email) || !payload.password) {
    throw createHttpError(401, 'invalid_credentials');
  }

  const result = await query(
    `
      SELECT id, email, display_name, password_hash, role, status, email_verified, created_at
      FROM users
      WHERE email_normalized = $1
      LIMIT 1
    `,
    [email],
  );

  const user = result.rows[0];

  if (!user || user.status !== 'active' || !(await verifyPassword(payload.password, user.password_hash))) {
    throw createHttpError(401, 'invalid_credentials');
  }

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  await createSession({ user, request, response });
  return { user: serializeUser(user) };
}

export async function getCurrentUser(request) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const session = await getSession(request);
  return session?.user || null;
}

export async function requireUser(request) {
  ensureDatabase();
  const session = await getSession(request);

  if (!session) {
    throw createHttpError(401, 'authentication_required');
  }

  return session;
}

export async function requireAdmin(request) {
  const session = await requireUser(request);

  if (!isAdminRole(session.user.role)) {
    throw createHttpError(403, 'admin_role_required');
  }

  return session;
}

export async function requireSuperAdmin(request) {
  const session = await requireUser(request);

  if (session.user.role !== 'super_admin') {
    throw createHttpError(403, 'super_admin_required');
  }

  return session;
}

export function requireCsrf(request, session) {
  const header = request.headers['x-csrf-token'];

  if (!header || hashToken(header) !== session.session.csrf_token_hash) {
    throw createHttpError(403, 'csrf_token_required');
  }
}

export async function logout({ request, response }) {
  const session = await requireUser(request);
  requireCsrf(request, session);
  await query('UPDATE user_sessions SET revoked_at = now() WHERE id = $1', [session.session.id]);
  clearAuthCookies(request, response);
  return { ok: true };
}

export async function forgotPassword({ payload, request }) {
  ensureDatabase();
  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email)) {
    return { ok: true };
  }

  const result = await query('SELECT id, email FROM users WHERE email_normalized = $1 AND status = $2 LIMIT 1', [
    email,
    'active',
  ]);
  const user = result.rows[0];

  if (!user) {
    return { ok: true };
  }

  const token = createOpaqueToken();
  await query(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, now() + ($3 || ' minutes')::interval)
    `,
    [user.id, hashToken(token), RESET_TOKEN_MINUTES],
  );

  await sendEmailSafely(() => sendPasswordResetEmail({ to: user.email, resetToken: token, origin: getRequestBaseUrl(request) }));
  return { ok: true };
}

export async function resetPassword({ payload }) {
  ensureDatabase();
  const passwordError = validatePassword(payload.password);

  if (!payload.token || passwordError) {
    throw createHttpError(400, passwordError ? 'weak_password' : 'invalid_reset_token');
  }

  const passwordHash = await hashPassword(payload.password);
  const result = await withTransaction(async (client) => {
    const tokenResult = await client.query(
      `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
        LIMIT 1
      `,
      [hashToken(payload.token)],
    );

    const tokenRow = tokenResult.rows[0];

    if (!tokenRow) {
      throw createHttpError(400, 'invalid_reset_token');
    }

    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, tokenRow.user_id]);
    await client.query('UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1', [tokenRow.id]);
    await client.query('UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1', [tokenRow.user_id]);
    return true;
  });

  return { ok: result };
}

export async function verifyEmail({ payload }) {
  ensureDatabase();

  if (!payload.token) {
    throw createHttpError(400, 'invalid_verification_token');
  }

  await withTransaction(async (client) => {
    const tokenResult = await client.query(
      `
        SELECT id, user_id
        FROM email_verification_tokens
        WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
        LIMIT 1
      `,
      [hashToken(payload.token)],
    );
    const tokenRow = tokenResult.rows[0];

    if (!tokenRow) {
      throw createHttpError(400, 'invalid_verification_token');
    }

    await client.query('UPDATE users SET email_verified = true WHERE id = $1', [tokenRow.user_id]);
    await client.query('UPDATE email_verification_tokens SET consumed_at = now() WHERE id = $1', [tokenRow.id]);
  });

  return { ok: true };
}

export async function listUsers() {
  ensureDatabase();
  const result = await query(
    `
      SELECT id, email, display_name, role, status, email_verified, created_at, last_login_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 100
    `,
  );

  return result.rows.map(serializeUser);
}

export async function updateUserRole(id, role) {
  ensureDatabase();

  if (!ALL_ROLES.has(role)) {
    throw createHttpError(400, 'invalid_role');
  }

  const result = await query(
    `
      UPDATE users
      SET role = $2
      WHERE id = $1
      RETURNING id, email, display_name, role, status, email_verified, created_at, last_login_at
    `,
    [id, role],
  );

  if (!result.rowCount) {
    throw createHttpError(404, 'user_not_found');
  }

  return serializeUser(result.rows[0]);
}

export function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || user.displayName || '',
    role: user.role,
    isAdmin: ADMIN_ROLES.has(user.role),
    isSuperAdmin: user.role === 'super_admin',
    status: user.status,
    emailVerified: Boolean(user.email_verified ?? user.emailVerified),
    createdAt: user.created_at || user.createdAt || null,
    lastLoginAt: user.last_login_at || user.lastLoginAt || null,
  };
}

async function getSession(request) {
  const token = parseCookies(request)[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const result = await query(
    `
      SELECT
        s.id,
        s.user_id,
        s.csrf_token_hash,
        u.email,
        u.display_name,
        u.role,
        u.status,
        u.email_verified,
        u.created_at,
        u.last_login_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.status = 'active'
      LIMIT 1
    `,
    [hashToken(token)],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    session: {
      id: row.id,
      user_id: row.user_id,
      csrf_token_hash: row.csrf_token_hash,
    },
    user: serializeUser({
      id: row.user_id,
      email: row.email,
      display_name: row.display_name,
      role: row.role,
      status: row.status,
      email_verified: row.email_verified,
      created_at: row.created_at,
      last_login_at: row.last_login_at,
    }),
  };
}

async function createSession({ user, request, response }) {
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `
      INSERT INTO user_sessions (user_id, token_hash, csrf_token_hash, expires_at, user_agent, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      user.id,
      hashToken(sessionToken),
      hashToken(csrfToken),
      expiresAt,
      String(request.headers['user-agent'] || '').slice(0, 500),
      getClientIp(request),
    ],
  );

  const secure = shouldUseSecureCookies(request);
  setCookie(response, SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  setCookie(response, CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

function clearAuthCookies(request, response) {
  const secure = shouldUseSecureCookies(request);
  clearCookie(response, SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'Lax', path: '/' });
  clearCookie(response, CSRF_COOKIE, { httpOnly: false, secure, sameSite: 'Lax', path: '/' });
}

function getInitialRole(email) {
  return parseCsvSet(process.env.SUPER_ADMIN_EMAILS).has(email) ? 'super_admin' : 'user';
}

function ensureDatabase() {
  if (!isDatabaseConfigured()) {
    throw createHttpError(503, 'database_not_configured');
  }
}

async function sendEmailSafely(callback) {
  try {
    await callback();
  } catch (error) {
    if (process.env.REQUIRE_SMTP === 'true') {
      throw error;
    }

    console.warn('Email delivery skipped or failed:', error.message);
  }
}

function shouldUseSecureCookies(request) {
  const configured = String(process.env.COOKIE_SECURE || '').trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(configured)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(configured)) {
    return false;
  }

  return process.env.NODE_ENV === 'production' || request.headers['x-forwarded-proto'] === 'https';
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}
