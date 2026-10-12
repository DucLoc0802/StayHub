import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeConfig } from '../src/common/runtime-config';
import { spawnSync } from 'node:child_process';
import { ConsoleLogger, LoggerService } from '@nestjs/common';
import { ProductionLogger } from '../src/common/production-logger';

const secret = 'test-fixture-only-0123456789-ABCDEF';
test('production framework error logging does not expose raw credential-bearing exceptions', () => {
  const original = ConsoleLogger.prototype.error;
  const logged: unknown[] = [];
  ConsoleLogger.prototype.error = (message: unknown) => { logged.push(message); };
  try {
    const logger: LoggerService = new ProductionLogger();
    logger.error('mysql://fixture:fixture@host/database', 'Authorization: Bearer fixture-token');
    assert.equal(logged.length, 1);
    assert.doesNotMatch(JSON.stringify(logged), /mysql:\/\/|Bearer|fixture-token/);
  } finally { ConsoleLogger.prototype.error = original; }
});
test('production demo seed refuses before connecting or modifying data', () => {
  const result = spawnSync(process.execPath, ['dist/seed/prisma/seed.js'], {
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: 'mysql://fixture:fixture@127.0.0.1:1/fixture' },
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Demo seeding is disabled in production/);
});
test('development origin remains local; missing and placeholder JWT secrets are rejected', () => {
  assert.equal(validateRuntimeConfig({ JWT_SECRET: secret }).origin, 'http://localhost:3000');
  for (const JWT_SECRET of ['', 'short', 'replace-' + 'x'.repeat(40)])
    assert.throws(() => validateRuntimeConfig({ JWT_SECRET }), /JWT_SECRET/);
});
test('production requires exact HTTPS origin, strong external secret and non-test MySQL configuration', () => {
  const env = { NODE_ENV: 'production', JWT_SECRET: secret, FRONTEND_URL: 'https://example.invalid', DATABASE_URL: 'mysql://fixture:fixture@mysql:3306/release_fixture' };
  assert.equal(validateRuntimeConfig(env).origin, env.FRONTEND_URL);
  for (const FRONTEND_URL of ['', '*', 'http://example.invalid', 'https://example.invalid/path', 'https://example.invalid/?redirect=other', 'https://example.invalid/#fragment'])
    assert.throws(() => validateRuntimeConfig({ ...env, FRONTEND_URL }), /FRONTEND_URL/);
  assert.throws(() => validateRuntimeConfig({ ...env, JWT_SECRET: 'x'.repeat(64) }), /JWT_SECRET/);
  for (const DATABASE_URL of ['', 'postgres://fixture:fixture@mysql/db', 'mysql://mysql/db', 'mysql://fixture:fixture@mysql/stayhub_inventory_test'])
    assert.throws(() => validateRuntimeConfig({ ...env, DATABASE_URL }), /DATABASE_URL/);
});

test('Vercel normalizes the deployed frontend origin and requires hosted MySQL', () => {
  const env = {
    NODE_ENV: 'production', VERCEL: '1', JWT_SECRET: secret,
    FRONTEND_URL: ' https://pentabug2-stayhub.vercel.app/ ',
    DATABASE_URL: 'mysql://fixture:fixture@db.example.invalid:3306/stayhub?connection_limit=1',
  };
  assert.equal(validateRuntimeConfig(env).origin, 'https://pentabug2-stayhub.vercel.app');
  for (const host of ['mysql', 'localhost', '127.0.0.1', '[::1]']) {
    assert.throws(() => validateRuntimeConfig({ ...env, DATABASE_URL: `mysql://fixture:fixture@${host}:3306/stayhub` }), /hosted MySQL/);
  }
  for (const DATABASE_URL of ['', 'mysql://fixture:fixture@db.example.invalid']) {
    assert.throws(() => validateRuntimeConfig({ ...env, DATABASE_URL }), /DATABASE_URL/);
  }
});
