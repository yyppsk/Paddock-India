import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_PREFIX = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = await scrypt(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS);
  return `${PASSWORD_HASH_PREFIX}$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split('$');

  if (parts.length !== 6 || parts[0] !== PASSWORD_HASH_PREFIX) {
    return false;
  }

  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64url');
  const derivedKey = await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });

  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

export function createOpaqueToken(byteLength = 32) {
  return randomBytes(byteLength).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('base64url');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_PATTERN.test(String(email || '').trim());
}

export function validatePassword(password) {
  const value = String(password || '');

  if (value.length < 10) {
    return 'Password must be at least 10 characters.';
  }

  if (!/[a-z]/i.test(value) || !/[0-9]/.test(value)) {
    return 'Password must include letters and numbers.';
  }

  return '';
}

export function sanitizeDisplayName(displayName) {
  return String(displayName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function isAdminRole(role) {
  return role === 'super_admin' || role === 'content_manager';
}

export function parseCsvSet(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean),
  );
}
