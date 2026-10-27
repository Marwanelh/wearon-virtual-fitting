import test from 'node:test';
import assert from 'node:assert/strict';
import { imageError, referenceSize, MAX_IMAGE_BYTES } from '../lib/policy.mjs';
import { sameOrigin } from '../lib/auth.mjs';

test('accepts bounded supported images and rejects empty, oversized, or active content', () => {
  assert.equal(imageError({ type: 'image/png', size: MAX_IMAGE_BYTES }), '');
  for (const file of [null, { type: 'image/svg+xml', size: 10 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }]) assert.ok(imageError(file));
});

test('local fallback validates the host and browser origin', () => {
  const request = (host, origin, site = 'same-origin') => new Request('http://localhost:3000/api/token', { headers: { host, origin, 'sec-fetch-site': site } });
  assert.ok(sameOrigin(request('127.0.0.1:3000', 'http://127.0.0.1:3000')));
  assert.equal(sameOrigin(request('evil.example', 'http://evil.example')), false);
  assert.equal(sameOrigin(request('localhost:3000', 'https://evil.example')), false);
  assert.equal(sameOrigin(request('localhost:3000', 'http://localhost:3000', 'cross-site')), false);
});

test('reference preparation bounds payload dimensions without stretching or upscaling', () => {
  assert.deepEqual(referenceSize(2000, 4000), { width: 512, height: 1024 });
  assert.deepEqual(referenceSize(800, 600), { width: 800, height: 600 });
  assert.deepEqual(referenceSize(4000, 1), { width: 1024, height: 1 });
  assert.throws(() => referenceSize(6000, 6000), /megapixels/);
  assert.throws(() => referenceSize(0, 100), /megapixels/);
  assert.throws(() => referenceSize(NaN, 100), /megapixels/);
});
