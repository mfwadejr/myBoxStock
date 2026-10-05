// ROUTES / host / alerts — current server problems, and the update status page.
import express from 'express';
import { hostLog } from './context.mjs';
import { list, more, dismiss, openCount, evaluate } from '../../services/alerts/index.mjs';
import { status, saveCheckUrl, checkNow } from '../../services/updates/index.mjs';

export function alertsRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json(await list(db)));
  r.get('/more', async (req, res) => res.json({ rows: await more(db, String(req.query.status || ''), req.query.offset) }));
  r.get('/count', async (req, res) => res.json({ open: await openCount(db) }));
  r.post('/check', async (req, res) => { await evaluate(db); res.json(await list(db)); });
  r.post('/:id/dismiss', async (req, res) => { await dismiss(db, String(req.params.id)); hostLog(req, 'info', 'alert.dismissed', 'An alert was set aside', { data: { id: req.params.id } }); res.json({ ok: true }); });
  return r;
}
export function updatesRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json(await status(db)));
  r.put('/', async (req, res) => {
    try { await saveCheckUrl(db, req.body?.url); } catch (e) { return res.status(400).json({ error: e.message }); }
    hostLog(req, 'info', 'update.address_saved', req.body?.url ? 'Release address saved' : 'Release checking turned off'); res.json(await status(db));
  });
  r.post('/check', async (req, res) => {
    try { await checkNow(db); } catch (e) { return res.status(400).json({ error: e.message }); }
    hostLog(req, 'info', 'update.checked', 'Checked for a newer release'); res.json(await status(db));
  });
  return r;
}
