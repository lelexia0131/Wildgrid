import express from 'express';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
const db = new DatabaseSync(new URL('./data/wildgrid.db', import.meta.url));
db.exec(`PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_hash TEXT NOT NULL UNIQUE
  );`);
const find = db.prepare('SELECT id FROM players WHERE device_hash = ?');
const insert = db.prepare('INSERT INTO players (device_hash) VALUES (?)');

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
      try {
        id = insert.run(deviceHash).lastInsertRowid;
      } catch (error) {
        id = find.get(deviceHash)?.id;
        if (id === undefined) throw error;
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
