import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionSummary } from '../lib/connection.mjs';

test('reports real measurements without presenting missing data as zero', () => {
  assert.equal(connectionSummary(null), 'Measuring connection…');
  assert.equal(connectionSummary({ warmingUp: true }), 'Measuring connection…');
  assert.equal(connectionSummary({ quality: 'good', metrics: { fps: 29.8, rttMs: 41, packetLoss: 0 } }), 'Good connection · 30 fps · 41 ms network round trip · 0% upload packet loss');
  assert.equal(connectionSummary({ quality: 'poor', metrics: { fps: 0, rttMs: null, packetLoss: 0.12 } }), 'Poor connection · 0 fps · — ms network round trip · 12% upload packet loss');
  assert.equal(connectionSummary({ quality: 'fair', metrics: { fps: NaN, rttMs: Infinity, packetLoss: -1 } }), 'Fair connection · — fps · — ms network round trip · —% upload packet loss');
});
