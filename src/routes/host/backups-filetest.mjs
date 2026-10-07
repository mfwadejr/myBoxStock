// ROUTES / host / backups-filetest — "Test a backup file": upload (streamed to disk) or pick a file in the backup folder, test it, restore it.
import express from 'express';
import { fail } from '../../core/messages.mjs';
import * as bk from '../../services/backup/index.mjs';
import { audit } from '../../services/backup/audit.mjs';

const bad = (res, e, status = 400) => (e?.code ? fail(res, e.code === 'HOST_BACKUP_UPLOAD_TOO_BIG' ? 413 : status, e.code) : res.status(status).json({ error: e.message }));

export function fileTestRoutes(db) {
  const r = express.Router();
  bk.cleanIncoming(); // anything left in the holding folder by an earlier run is removed
  r.get('/', (req, res) => res.json({ limitBytes: bk.uploadLimit(), folder: bk.folderFiles(), dir: bk.backupDir(), sqlite: db.client === 'sqlite' }));
  r.post('/upload', async (req, res) => {
    try { res.json(await bk.receiveUpload(req, { name: String(req.query.name || ''), actor: req.subject.username, ip: req.ip })); }
    catch (e) { res.set('Connection', 'close'); bad(res, e); }
  });
  r.delete('/upload/:id', (req, res) => { bk.discardUpload(req.params.id, req.subject.username); res.json({ ok: true }); });
  r.post('/run', async (req, res) => {
    try { res.json(await bk.testBackupFile(db, req.body?.source, { passphrase: String(req.body?.passphrase || ''), actor: req.subject.username, ip: req.ip })); } catch (e) { bad(res, e, 404); }
  });
  r.delete('/token/:token', (req, res) => { bk.dropFileToken(req.params.token); res.json({ ok: true }); });
  r.post('/restore', async (req, res) => {
    const b = req.body || {};
    if (b.confirm !== 'RESTORE') return fail(res, 400, 'HOST_BACKUP_RESTORE_CONFIRM');
    try {
      const l = await bk.withBackupLock('a restore', () => bk.restoreBackupFile(db, { token: b.token, passphrase: String(b.passphrase || ''), actor: req.subject.username, ip: req.ip }));
      if (l.skipped) return fail(res, 409, 'HOST_BACKUP_BUSY');
      res.json({ ok: true, restarting: true, safetyCopy: l.value.safetyCopy }); setTimeout(() => process.exit(0), 600);
    } catch (e) { audit('backup.restore', `Restore from an uploaded or placed backup file refused: ${e.message}`, { actor: req.subject.username, ip: req.ip, level: 'warn', data: { ok: false, source: 'file' } }); bad(res, e); }
  });
  return r;
}
