import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  validatePassword,
  verifyPassword,
} from '../src/security.js';

test('password hashing verifies correct password and rejects wrong password', async () => {
  const hash = await hashPassword('CircuitPass123');

  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassword('CircuitPass123', hash), true);
  assert.equal(await verifyPassword('WrongPass123', hash), false);
});

test('email and password validation are strict enough for signup', () => {
  assert.equal(normalizeEmail('  Driver@Example.COM '), 'driver@example.com');
  assert.equal(isValidEmail('driver@example.com'), true);
  assert.equal(isValidEmail('driver-at-example'), false);
  assert.equal(validatePassword('short1'), 'Password must be at least 10 characters.');
  assert.equal(validatePassword('longbutnodigits'), 'Password must include letters and numbers.');
  assert.equal(validatePassword('CircuitPass123'), '');
});
