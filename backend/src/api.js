import {
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  requireAdmin,
  requireCsrf,
  requireSuperAdmin,
  resetPassword,
  signup,
  updateUserRole,
  verifyEmail,
  listUsers,
} from './auth.js';
import { createContentSection, listAdminContentSections, listPublicContentSections, updateContentSection } from './content.js';
import { getPublicPostgresStatus } from './database.js';
import { createHttpError, getRequestBaseUrl, readJsonBody, sendJson } from './http.js';
import { listMigrationStatus, runMigrations } from './migrations.js';

const AUTH_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };
const WRITE_LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };
const rateLimitBuckets = new Map();

export function createApiHandler() {
  return async function handleApiRequest(request, response) {
    const url = new URL(request.url, getRequestBaseUrl(request));

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'paddockindia-api',
        environment: process.env.NODE_ENV || 'development',
        uptime: Number(process.uptime().toFixed(2)),
        postgres: getPublicPostgresStatus(),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/config') {
      sendJson(response, 200, {
        ok: true,
        postgres: getPublicPostgresStatus(),
        frontendServedBy: 'node',
        auth: { enabled: getPublicPostgresStatus().configured },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/content/public') {
      sendJson(response, 200, { ok: true, sections: await listPublicContentSections() });
      return;
    }

    if (url.pathname.startsWith('/api/auth/')) {
      await handleAuthRequest(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/admin/')) {
      await handleAdminRequest(request, response, url);
      return;
    }

    sendJson(response, 404, { ok: false, error: 'api_route_not_found' });
  };
}

async function handleAuthRequest(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/auth/session') {
    sendJson(response, 200, { ok: true, user: await getCurrentUser(request) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
    enforceRateLimit(request, 'auth:signup', AUTH_LIMIT);
    const result = await signup({ payload: await readJsonBody(request), request, response });
    sendJson(response, 201, { ok: true, ...result });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    enforceRateLimit(request, 'auth:login', AUTH_LIMIT);
    const result = await login({ payload: await readJsonBody(request), request, response });
    sendJson(response, 200, { ok: true, ...result });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const result = await logout({ request, response });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
    enforceRateLimit(request, 'auth:forgot', AUTH_LIMIT);
    const result = await forgotPassword({ payload: await readJsonBody(request), request });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    enforceRateLimit(request, 'auth:reset', AUTH_LIMIT);
    const result = await resetPassword({ payload: await readJsonBody(request) });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/verify-email') {
    enforceRateLimit(request, 'auth:verify', AUTH_LIMIT);
    const result = await verifyEmail({ payload: await readJsonBody(request) });
    sendJson(response, 200, result);
    return;
  }

  sendJson(response, 404, { ok: false, error: 'auth_route_not_found' });
}

async function handleAdminRequest(request, response, url) {
  const session = needsSuperAdmin(url.pathname) ? await requireSuperAdmin(request) : await requireAdmin(request);

  if (!['GET', 'HEAD'].includes(request.method)) {
    enforceRateLimit(request, 'admin:write', WRITE_LIMIT);
    requireCsrf(request, session);
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/content') {
    sendJson(response, 200, { ok: true, sections: await listAdminContentSections() });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/content') {
    const section = await createContentSection(await readJsonBody(request), session.user.id);
    sendJson(response, 201, { ok: true, section });
    return;
  }

  const contentMatch = url.pathname.match(/^\/api\/admin\/content\/([0-9a-f-]{36})$/i);

  if (contentMatch && request.method === 'PATCH') {
    const section = await updateContentSection(contentMatch[1], await readJsonBody(request), session.user.id);
    sendJson(response, 200, { ok: true, section });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/users') {
    sendJson(response, 200, { ok: true, users: await listUsers() });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/system/migrations') {
    const status = await listMigrationStatus({ requireDatabase: true });
    sendJson(response, 200, { ok: true, ...status });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/system/migrations/run') {
    const result = await runMigrations({ requireDatabase: true });
    const status = await listMigrationStatus({ requireDatabase: true });
    sendJson(response, 200, { ok: true, applied: result.applied, ...status });
    return;
  }

  const userRoleMatch = url.pathname.match(/^\/api\/admin\/users\/([0-9a-f-]{36})\/role$/i);

  if (userRoleMatch && request.method === 'PATCH') {
    const payload = await readJsonBody(request);
    const user = await updateUserRole(userRoleMatch[1], payload.role);
    sendJson(response, 200, { ok: true, user });
    return;
  }

  sendJson(response, 404, { ok: false, error: 'admin_route_not_found' });
}

function needsSuperAdmin(pathname) {
  return pathname.startsWith('/api/admin/users') || pathname.startsWith('/api/admin/system/');
}

function enforceRateLimit(request, bucketName, { limit, windowMs }) {
  const ip = String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    throw createHttpError(429, 'rate_limit_exceeded');
  }
}
