// ROUTES / host / backups — the Backups page: settings per tier, lists, run now, download, delete, restore, test restore, destinations.
import express from 'express';
import { hostLog } from './context.mjs';
import * as bk from '../../services/backup/index.mjs';
import { listDestinations, enabledDestinations, clientFor } from '../../services/backup/destinations/index.mjs';
import { destinationsRoutes } from './backups-destinations.mjs';
import { takenAtFromName } from '../../services/backup/files.mjs';

const TIERS = ['frequent', 'full', 'safety'], busyMsg = (by) => `Another backup is running (${by}). Try again in a minute.`;
// Where the plain database snapshots stand today, in plain words (shown on the page).
const PLAIN_NOTE = 'Snapshots in this server\u2019s backup folder are plain database files, readable only by the app\u2019s own user. Passwords are hashed, two-factor secrets and saved mail/destination passwords are sealed with this server\u2019s key (which is not inside a snapshot), and customers\u2019 inventory, customers and sales are encrypted in their own browsers. Account names, e-mail addresses and plan details are readable, so keep the folder private. Anything sent away from this server is encrypted with your backup passphrase first.';

export function backupsRoutes(db) {
  const r = express.Router(), H = (req, lvl, ev, msg, data) => hostLog(req, lvl, ev, msg, { data });
  r.use('/destinations', destinationsRoutes(db));
  r.get('/', async (req, res) => res.json({ backups: bk.listBackups(), schedule: await bk.getSchedule(db), full: await bk.getFullConfig(db), fullStatus: await bk.getFullStatus(db), engine: db.client, restorePending: bk.restorePending(),
    tiers: await bk.getTiers(db), overview: await bk.backupOverview(db), destinations: await listDestinations(db), busy: bk.backupBusy(), plainNote: PLAIN_NOTE, localDir: bk.backupDir(), defaultDir: bk.defaultBackupDir() }));
  // One page of a tier's files, newest first: { rows, total }.
  r.get('/files', (req, res) => {
    const tier = String(req.query.tier || 'frequent'); if (!TIERS.includes(tier)) return res.status(400).json({ error: 'Unknown list.' });
    const off = Math.max(0, Number(req.query.offset) || 0), lim = Math.min(200, Math.max(1, Number(req.query.limit) || 50)), all = bk.listBackups().filter(b => b.tier === tier);
    res.json({ rows: all.slice(off, off + lim), total: all.length, bytes: all.reduce((n, b) => n + b.size, 0) });
  });
  // Copies held at the offsite destinations (read from the destinations themselves).
  r.get('/offsite', async (req, res) => {
    const t = await bk.getTiers(db), full = await bk.getFullConfig(db), ids = [...new Set([...t.offsite.destinations, ...(full.destinationIds || [])])], rows = [], problems = [];
    for (const d of await enabledDestinations(db, ids)) { try { for (const f of await clientFor(d).list()) if (/^myboxstock-(offsite|fullsite|snap|manual|auto)/.test(f.name)) rows.push({ destination: d.id, destinationName: d.name, name: f.name, size: f.size, takenAt: takenAtFromName(f.name, f.mtime), tier: f.name.includes('-fullsite-') ? 'full' : 'offsite' }); } catch (e) { problems.push({ destination: d.name, error: e.message }); } }
    rows.sort((a, b) => b.takenAt - a.takenAt);
    const off = Math.max(0, Number(req.query.offset) || 0), lim = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json({ rows: rows.slice(off, off + lim), total: rows.length, bytes: rows.reduce((n, b) => n + (b.size || 0), 0), problems });
  });
  r.put('/tiers', async (req, res) => {
    try { const tiers = await bk.saveTiers(db, req.body || {}, req.subject.username); H(req, 'info', 'backup.settings_saved', 'Backup frequency and retention settings changed', { frequent: tiers.frequent, offsite: { ...tiers.offsite, destinations: tiers.offsite.destinations.length }, safety: tiers.safety }); res.json({ tiers, overview: await bk.backupOverview(db) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.post('/run/:tier', async (req, res) => {
    const tier = req.params.tier; if (!['frequent', 'offsite'].includes(tier)) return res.status(404).end();
    const out = await bk.withBackupLock(`a ${tier} run`, () => (tier === 'frequent' ? bk.runFrequent : bk.runOffsite)(db, { actor: req.subject.username, trigger: 'manual' }));
    if (out.skipped) return res.status(409).json({ error: busyMsg(out.by) });
    res.status(out.value.ok ? 200 : 400).json(out.value.ok ? out.value : { error: out.value.error });
  });
  // What a restore will do, in numbers the confirmation sheet can show.
  r.get('/:name/restore-info', (req, res) => {
    try {
      bk.backupPath(req.params.name); const b = bk.listBackups().find(x => x.name === req.params.name), takenAt = takenAtFromName(req.params.name, b?.created);
      const can = db.client === 'sqlite' && (b.kind === 'sqlite' || b.kind === 'fullsite');
      res.json({ name: req.params.name, size: b.size, kind: b.kind, takenAt, takenAtText: bk.whenText(takenAt), agoMs: Date.now() - takenAt, canRestore: can, reason: can ? '' : db.client !== 'sqlite' ? 'Restore on a PostgreSQL / MariaDB server by loading the dump with psql / mysql.' : 'Only SQLite snapshots and full-site backups can be restored here.', needsPassphrase: b.kind === 'fullsite', safetyCopy: true, restarts: true });
    } catch { res.status(404).json({ error: 'That backup was not found.' }); }
  });
  r.post('/:name/test-restore', async (req, res) => {
    try { const out = await bk.testRestore(db, req.params.name, { passphrase: String(req.body?.passphrase || ''), actor: req.subject.username }); bk.audit('backup.test_restore', `Test restore of ${req.params.name}: ${out.ok ? 'passed' : 'failed'}`, { actor: req.subject.username, ip: req.ip, data: { name: req.params.name, ok: out.ok } }); res.json(out); }
    catch (e) { res.status(404).json({ error: e.message === 'Not found' ? 'That backup was not found.' : e.message }); }
  });
  r.post('/', async (req, res) => {
    const out = await bk.withBackupLock('a manual backup', async () => { const name = await bk.createBackup(db, 'manual', req.subject.username); await bk.recordTier(db, 'manual', { lastOk: { at: Date.now(), name, verified: true, trigger: 'manual' } }); H(req, 'info', 'backup.run', `Manual snapshot ${name} taken`, { tier: 'manual', name }); return name; }).catch(e => ({ error: e }));
    if (out.error) return res.status(500).json({ error: out.error.message }); if (out.skipped) return res.status(409).json({ error: busyMsg(out.by) });
    res.json({ ok: true, name: out.value });
  });
  // Full-site backup: database + encryption key in one file protected by a passphrase the host chooses (never stored or logged).
  r.post('/bundle', async (req, res) => { try { const name = await bk.createBundle(db, req.body?.passphrase, req.subject.username); H(req, 'info', 'backup.run', `Full-site backup ${name} made by hand`, { tier: 'full', name }); res.json({ ok: true, name }); } catch (e) { res.status(400).json({ error: e.message }); } });
  r.post('/:name/restore-bundle', async (req, res) => {
    if (db.client !== 'sqlite') return res.status(400).json({ error: 'Restore on a PostgreSQL / MariaDB server by loading the dump with psql / mysql.' });
    if (req.body?.confirm !== 'RESTORE') return res.status(400).json({ error: 'Type RESTORE to confirm.' });
    try {
      const file = bk.backupPath(req.params.name); if (!file.endsWith('.mbsbak')) throw new Error('That is not a full-site backup.');
      bk.stageBundleRestore(file, req.body?.passphrase || '', req.subject.username); // checks the passphrase before anything else happens
      const pre = await bk.createBackup(db, 'pre-restore', req.subject.username);
      H(req, 'warn', 'backup.restore', `Full-site restore of ${req.params.name} requested (safety copy ${pre}); restarting`, { name: req.params.name, safetyCopy: pre });
      res.json({ ok: true, restarting: true }); setTimeout(() => process.exit(0), 600);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.put('/full', async (req, res) => { try { res.json(await bk.saveFullConfig(db, req.body || {}, req.subject.username)); } catch (e) { res.status(400).json({ error: e.message }); } });
  r.post('/full/run', async (req, res) => { const l = await bk.withBackupLock('a full-site backup', () => bk.runFullBackup(db, 'manual', req.subject.username)); if (l.skipped) return res.status(409).json({ error: busyMsg(l.by) }); const out = l.value; res.status(out.ok ? 200 : 400).json(out.ok ? out : { error: out.error }); });
  r.put('/schedule', async (req, res) => res.json(await bk.saveSchedule(db, req.body, req.subject.username)));
  r.get('/:name/download', (req, res) => { try { const p = bk.backupPath(req.params.name); H(req, 'info', 'backup.download', `Downloaded backup ${req.params.name}`, { name: req.params.name }); res.download(p); } catch { res.status(404).end(); } });
  r.delete('/:name', async (req, res) => { try { bk.deleteBackup(req.params.name, req.subject.username); H(req, 'warn', 'backup.delete', `Deleted backup ${req.params.name}`, { name: req.params.name }); res.json({ ok: true }); } catch (e) { res.status(404).json({ error: e.message }); } });
  r.post('/:name/restore', async (req, res) => {
    if (db.client !== 'sqlite') return res.status(400).json({ error: 'Restore SQL dumps with psql / mysql, then restart.' });
    if (req.body.confirm !== 'RESTORE') return res.status(400).json({ error: 'Type RESTORE to confirm.' });
    try {
      const pre = await bk.createBackup(db, 'pre-restore', req.subject.username);
      bk.stageRestore(req.params.name, req.subject.username);
      H(req, 'warn', 'backup.restore', `Restore of ${req.params.name} requested (safety copy ${pre}); restarting`, { name: req.params.name, safetyCopy: pre });
      res.json({ ok: true, restarting: true });
      setTimeout(() => process.exit(0), 600); // the supervisor (Docker restart policy) restarts the app with the restored database
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  return r;
}
