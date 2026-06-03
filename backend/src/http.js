const JSON_LIMIT_BYTES = 64 * 1024;

export async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > JSON_LIMIT_BYTES) {
      throw createHttpError(413, 'payload_too_large');
    }

    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw createHttpError(400, 'invalid_json');
  }
}

export function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  response.end(JSON.stringify(body));
}

export function sendError(response, error) {
  const statusCode = error.statusCode || 500;
  sendJson(response, statusCode, {
    ok: false,
    error: error.publicCode || (statusCode >= 500 ? 'internal_server_error' : error.message || 'request_failed'),
  });
}

export function createHttpError(statusCode, publicCode, message = publicCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicCode = publicCode;
  return error;
}

export function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        const key = separator === -1 ? part : part.slice(0, separator);
        const value = separator === -1 ? '' : part.slice(separator + 1);
        return [decodeURIComponent(key), decodeURIComponent(value)];
      }),
  );
}

export function setCookie(response, name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Number(options.maxAge) || 0)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  const existing = response.getHeader('Set-Cookie');
  const cookies = Array.isArray(existing) ? existing : existing ? [existing] : [];
  response.setHeader('Set-Cookie', [...cookies, parts.join('; ')]);
}

export function clearCookie(response, name, options = {}) {
  setCookie(response, name, '', { ...options, maxAge: 0 });
}

export function getRequestBaseUrl(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'http';
  const hostHeader = request.headers['x-forwarded-host'] || request.headers.host || 'localhost';
  return `${protocol}://${hostHeader}`;
}

export function getClientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || '')
    .split(',')[0]
    .trim()
    .slice(0, 80);
}

export function addBaseHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Frame-Options', 'DENY');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
