import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveApiUrl } from '../src/lib/api-config.ts';

test('production calls the deployed backend when the API variable is missing or empty', () => {
  for (const value of [undefined, '', '  ']) {
    assert.equal(
      resolveApiUrl(value, true),
      'https://pentabug-stayhub.vercel.app/api',
    );
  }
  assert.equal(resolveApiUrl(undefined, false), 'http://localhost:4000/api');
});

test('backend origin and trailing slashes resolve to the API prefix used by NestJS', () => {
  for (const value of [
    'https://pentabug-stayhub.vercel.app',
    'https://pentabug-stayhub.vercel.app/',
    ' https://pentabug-stayhub.vercel.app/api/ ',
  ]) {
    assert.equal(
      resolveApiUrl(value, true),
      'https://pentabug-stayhub.vercel.app/api',
    );
  }
});

test('explicit local, proxy and custom API paths remain configurable', () => {
  assert.equal(resolveApiUrl('/api/', true), '/api');
  assert.equal(
    resolveApiUrl('http://localhost:4000/api', true),
    'http://localhost:4000/api',
  );
  assert.equal(
    resolveApiUrl('https://example.com/service/api/', true),
    'https://example.com/service/api',
  );
});
