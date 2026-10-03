// ROUTES / host / backups — list, create, download, delete, restore, schedule.
import express from 'express';
import { hostLog } from './context.mjs';
import * as bk from '../../services/backup/index.mjs';

export function backupsRoutes(db) {
  const r = express.Router(), H = (req, lvl, ev, msg, data) => hostLog(req, lvl, ev, msg, { data });
  r.get('/', async (req, res) => res.json({ backups: bk.listBackups(), schedule: await bk.getSchedule(db), engine: db.client, restorePending: bk.restorePending() }));
  r.post('/', async (req, res) => { try { const name = await bk.createBackup(db, 'manual', req.subject.username); res.json({ ok: true, name }); } catch (e) { res.status(500).json({ error: e.message }); } });
  r.put('/schedule', async (req, res) => res.json(await bk.saveSchedule(db, req.body, req.subject.username)));
  r.get('/:name/download', (req, res) => { try { const p = bk.backupPath(req.params.name); H(req, 'info', 'backup.downloaded', `Downloaded backup ${req.params.name}`, { name: req.params.name }); res.download(p); } catch { res.status(404).end(); } });
  r.delete('/:name', async (req, res) => { try { bk.deleteBackup(req.params.name, req.subject.username); res.json({ ok: true }); } catch (e) { res.status(404).json({ error: e.message }); } });
  r.post('/:name/restore', async (req, res) => {
    if (db.client !== 'sqlite') return res.status(400).json({ error: 'Restore SQL dumps with psql / mysql, then restart.' });
    if (req.body.confirm !== 'RESTORE') return res.status(400).json({ error: 'Type RESTORE to confirm.' });
    try {
      const pre = await bk.createBackup(db, 'pre-restore', req.subject.username);
      bk.stageRestore(req.params.name, req.subject.username);
      H(req, 'warn', 'backup.restore_requested', `Restore of ${req.params.name} requested (safety copy ${pre}); restarting`, { name: req.params.name, safetyCopy: pre });
      res.json({ ok: true, restarting: true });
      setTimeout(() => process.exit(0), 600); // the supervisor (Docker restart policy) restarts the app with the restored database
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  return r;
}
