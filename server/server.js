import express from 'express';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
const db = new DatabaseSync(new URL('./data/wildgrid.db', import.meta.url));
db.exec(`PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_hash TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS registration_events (registered_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS registration_events_time ON registration_events (registered_at);`);
const find = db.prepare('SELECT id FROM players WHERE device_hash = ?');
const insert = db.prepare('INSERT INTO players (device_hash) VALUES (?)');
const recordRegistration = db.prepare('INSERT INTO registration_events (registered_at) VALUES (?)');
const clearExpired = db.prepare('DELETE FROM registration_events WHERE registered_at <= ?');
const countRegistrations = db.prepare('SELECT COUNT(*) AS count, MIN(registered_at) AS oldest FROM registration_events WHERE registered_at > ?');
const registrationLimits = [
  { duration: 60_000, max: 10 },
  { duration: 3_600_000, max: 100 },
  { duration: 86_400_000, max: 300 },
];

setInterval(() => {
  try { clearExpired.run(Date.now() - 86_400_000); } catch {}
}, 60_000).unref();

const app = express();
app.disable('x-powered-by');
app.disable('etag');
app.post('/api/player-id', (req, res, next) => {
  if (!req.is('application/json')) return res.status(400).json({ error: 'Invalid request' });
  next();
}, express.json({ limit: 1024 }), (req, res) => {
  const hash = req.body?.deviceHash;
  if (typeof hash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(hash) || Object.keys(req.body).length !== 1) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const deviceHash = hash.toLowerCase();
  try {
    let id = find.get(deviceHash)?.id;
    if (id === undefined) {
      db.exec('BEGIN IMMEDIATE');
      try {
        // Another process may have registered this device while we waited for the lock.
        id = find.get(deviceHash)?.id;
        if (id === undefined) {
          const now = Date.now();
          clearExpired.run(now - 86_400_000);
          let retryAfter = 0;
          for (const { duration, max } of registrationLimits) {
            const { count, oldest } = countRegistrations.get(now - duration);
            if (count >= max) retryAfter = Math.max(retryAfter, Math.ceil((oldest + duration - now) / 1000));
          }
          if (retryAfter > 0) {
            db.exec('COMMIT');
            return res.set('Retry-After', String(retryAfter)).set('Cache-Control', 'no-store')
              .status(429).json({ error: 'Registration limit reached' });
          }
          id = insert.run(deviceHash).lastInsertRowid;
          recordRegistration.run(now);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    res.set('Cache-Control', 'no-store').json({ id: String(id).padStart(6, '0') });
  } catch {
    res.status(503).json({ error: 'Player ID unavailable' });
  }
});
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, _req, res, _next) => {
  res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid request' });
});
const server = app.listen(3001, '127.0.0.1');
server.requestTimeout = 10000;
