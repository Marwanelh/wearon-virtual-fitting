import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { issueSession, verifySession, sameOrigin } from '../lib/auth.mjs';
import { initUsage, consume } from '../lib/usage.mjs';
import { garments, CATEGORIES, garmentPrompt, framingTip } from '../lib/catalog.mjs';
import { deadline } from '../lib/async.mjs';

test('signed invitations reject tampering, wrong keys, malformed input and expiry', () => {
  const token = issueSession('test-secret', 1000);
  assert.ok(verifySession(token, 'test-secret', 1001));
  for (const bad of ['', token + '.x', 'garbage', token.slice(0, -4) + 'xxxx']) assert.equal(verifySession(bad, 'test-secret', 1001), null);
  assert.equal(verifySession(token, 'wrong-key', 1001), null);
  assert.equal(verifySession(token, 'test-secret', 1000 + 8 * 60 * 60 * 1000), null);
});

test('production origin is explicit and rejects missing or foreign origins', () => {
  const old = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'https://demo.example';
  try {
    const req = origin => new Request('http://internal:3000/api/token', { headers: origin ? { origin } : {} });
    assert.equal(sameOrigin(req('https://demo.example')), true);
    assert.equal(sameOrigin(req('https://demo.example.evil.com')), false);
    assert.equal(sameOrigin(req()), false);
  } finally { if (old === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = old; }
});

test('usage allowance enforces a sliding window without consuming rejected attempts', () => {
  const db = initUsage(':memory:');
  try {
    assert.equal(consume('daily', 'global', 2, 100, 1000, db), true);
    assert.equal(consume('daily', 'global', 2, 100, 1001, db), true);
    assert.equal(consume('daily', 'global', 2, 100, 1002, db), false);
    assert.equal(consume('daily', 'global', 2, 100, 1099, db), false);
    assert.equal(consume('daily', 'global', 2, 100, 1100, db), true);
    assert.equal(consume('token', 'other', 1, 100, 1100, db), true);
  } finally { db.close(); }
});

test('every collection piece has an original usable image and category-specific instructions', async () => {
  assert.equal(new Set(garments.map(item => item.id)).size, garments.length);
  for (const item of garments) {
    assert.ok(CATEGORIES.includes(item.category));
    const image = await readFile(new URL(`../public${item.image}`, import.meta.url));
    assert.deepEqual([...image.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    assert.ok(image.length < 10 * 1024 * 1024);
    const prompt = garmentPrompt(item.category, item.description);
    assert.ok(prompt.includes(item.description));
    assert.ok(prompt.includes('Replace all logos, lettering and graphics from the original clothing'));
    assert.ok(prompt.includes(item.category === 'Trousers' ? 'lower body' : ['Dresses', 'Full outfits'].includes(item.category) ? 'outfit' : 'upper body'));
  }
});

test('full outfits request both garments and head-to-toe framing', () => {
  const outfit = garments.find(item => item.category === 'Full outfits');
  assert.ok(outfit);
  assert.match(garmentPrompt(outfit.category, outfit.description), /both the top and trousers together/);
  assert.match(framingTip(outfit.category), /head, torso, waist and feet/);
});

test('plain tee explicitly removes source graphics without forcing uploaded garments to be blank', () => {
  const tee = garments.find(item => item.id === 'ivory-tee');
  assert.match(garmentPrompt(tee.category, tee.description), /plain, unprinted.*no logo/);
  assert.doesNotMatch(garmentPrompt('T-shirts'), /unprinted|no logo/);
});

test('timed-out camera or connection promises clean up their late resource', async () => {
  let cleaned = false;
  await assert.rejects(deadline(new Promise(resolve => setTimeout(() => resolve('stream'), 25)), 5, value => { assert.equal(value, 'stream'); cleaned = true; }), /timed out/);
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(cleaned, true);
  assert.equal(await deadline(Promise.resolve('ready'), 100), 'ready');
});
