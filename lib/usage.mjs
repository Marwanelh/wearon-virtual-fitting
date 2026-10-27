import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function initUsage(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS attempts (kind TEXT, subject TEXT, at INTEGER); CREATE INDEX IF NOT EXISTS attempts_lookup ON attempts(kind, subject, at);');
  return db;
}

function database() {
  if (!globalThis.wearonUsage) {
    const dir = process.env.DATA_DIR || '.data';
    mkdirSync(dir, { recursive: true });
    globalThis.wearonUsage = initUsage(join(dir, 'usage.sqlite'));
  }
  return globalThis.wearonUsage;
}

// shortcut: one application process with persistent storage; use a shared database before scaling.
export function consume(kind, subject, limit, windowMs, now = Date.now(), db = database()) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM attempts WHERE at <= ?').run(now - 86400000);
    const { count } = db.prepare('SELECT count(*) AS count FROM attempts WHERE kind = ? AND subject = ? AND at > ?').get(kind, subject, now - windowMs);
    if (count >= limit) { db.exec('ROLLBACK'); return false; }
    db.prepare('INSERT INTO attempts VALUES (?, ?, ?)').run(kind, subject, now);
    db.exec('COMMIT');
    return true;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
