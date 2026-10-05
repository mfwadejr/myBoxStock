// ROUTES / host / backups-destinations — add, change, test and remove the places backups are sent, and look at what is stored there.
// Passwords and keys go in sealed and never come back (the page only sees "saved").
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { hostLog } from './context.mjs';
import { TYPES, listDestinations, saveDestination, deleteDestination, testDestination, getDestination, clientFor } from '../../services/backup/destinations/index.mjs';

const okName = (n) => /^[\w.-]+$/.test(n) && !n.includes('..');
export function destinationsRoutes(db) {
  const r = express.Router(), H = (req, lvl, ev, msg, data) => hostLog(req, lvl, ev, msg, { data });
  r.get('/', async (req, res) => res.json({ destinations: await listDestinations(db), types: Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, { label: v.label, secrets: v.secrets }])) }));
  const write = (isNew) => async (req, res) => {
    try {
      const d = await saveDestination(db, req.body || {}, req.subject.username, isNew ? null : req.params.id);
      H(req, 'info', 'backup.destination_saved', `Backup destination "${d.name}" (${d.type}) ${isNew ? 'added' : 'changed'}`, { id: d.id, type: d.type, enabled: d.enabled }); res.json(d);
    } catch (e) { res.status(400).json({ error: e.message }); }
  };
  r.post('/', write(true));
  r.put('/:id', write(false));
  r.delete('/:id', async (req, res) => {
    try { const d = await deleteDestination(db, req.params.id, req.subject.username); H(req, 'warn', 'backup.destination_deleted', `Backup destination "${d.name}" removed`, { id: d.id, type: d.type }); res.json({ ok: true }); }
    catch (e) { res.status(404).json({ error: e.message }); }
  });
  r.post('/:id/test', async (req, res) => {
    try { const out = await testDestination(db, req.params.id, req.subject.username); H(req, out.ok ? 'info' : 'warn', 'backup.destination_test', `Test connection to destination ${req.params.id}: ${out.ok ? 'worked' : 'failed'}`, { id: req.params.id, ok: out.ok }); res.json(out); }
    catch (e) { res.status(404).json({ error: e.message }); }
  });
  r.delete('/:id/files/:name', async (req, res) => {
    try { if (!okName(req.params.name)) throw new Error('Bad name.'); const d = await getDestination(db, req.params.id); await clientFor(d).remove(req.params.name); H(req, 'warn', 'backup.delete', `Deleted ${req.params.name} from destination "${d.name}"`, { name: req.params.name, destination: d.name }); res.json({ ok: true }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.get('/:id/files/:name/download', async (req, res) => {
    let dir;
    try {
      if (!okName(req.params.name)) throw new Error('Bad name.'); const d = await getDestination(db, req.params.id);
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-dl-')); const f = path.join(dir, req.params.name); await clientFor(d).get(req.params.name, f);
      H(req, 'info', 'backup.download', `Downloaded ${req.params.name} from destination "${d.name}"`, { name: req.params.name, destination: d.name });
      res.download(f, req.params.name, () => fs.rmSync(dir, { recursive: true, force: true }));
    } catch (e) { if (dir) fs.rmSync(dir, { recursive: true, force: true }); res.status(400).json({ error: e.message }); }
  });
  return r;
}
