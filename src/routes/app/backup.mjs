// ROUTES / app / backup — reseller backup and restore bookkeeping, the 7-day restore point, and the diagnostics text. Administrators only.
// The backup file itself is built and read in the browser; nothing here ever sees what is inside a record.
import express from 'express';
import { need, tenantLog } from './context.mjs';
import { fail } from '../../core/messages.mjs';
import { log } from '../../logging/logger.mjs';
import { vaultEnabled } from '../../services/vault/keys.mjs';
import { currentPoint, makePoint, undoPoint } from '../../services/backup/restorepoint.mjs';
import { buildDiagnostics } from '../../services/backup/diagnostics.mjs';

const num = (v) => Math.max(0, Math.min(1e9, Math.floor(Number(v) || 0)));
const counts = (b) => ({ devices: num(b?.devices), customers: num(b?.customers), sales: num(b?.sales), records: num(b?.records) });

export function backupRoutes(db) {
  const r = express.Router(), admin = need('users.manage');
  const ready = async (req, res, next) => (await vaultEnabled(db, req.subject.account_id)) ? next() : fail(res, 409, 'VAULT_NOT_READY');

  r.get('/status', admin, async (req, res) => {
    const a = await db.get('SELECT last_backup_at FROM accounts WHERE id = ?', [req.subject.account_id]);
    res.json({ lastBackupAt: a?.last_backup_at ? Number(a.last_backup_at) : null, restorePoint: await currentPoint(db, req.subject.account_id), now: Date.now() });
  });
  // The browser tells us a full backup file was just made. Only the time is kept, plus counts in the log.
  r.post('/made', admin, ready, async (req, res) => {
    const now = Date.now(), c = counts(req.body);
    await db.run('UPDATE accounts SET last_backup_at = ? WHERE id = ?', [now, req.subject.account_id]);
    tenantLog(req, 'backup.file_created', `${req.subject.login} saved a full backup file of the account (${c.records} records)`, c);
    res.json({ ok: true, lastBackupAt: now });
  });
  // Step 1 of a restore: refuse another account's file, then save the safety copy. After this the browser writes the records.
  r.post('/restore/begin', admin, ready, async (req, res) => {
    const code = String(req.body?.accountCode || ''), mode = req.body?.mode === 'replace' ? 'replace' : req.body?.mode === 'merge' ? 'merge' : null;
    if (!mode) return fail(res, 400, 'BACKUP_BAD');
    const a = await db.get('SELECT account_code FROM accounts WHERE id = ?', [req.subject.account_id]);
    if (code.toLowerCase() !== String(a.account_code).toLowerCase()) {
      log('tenant', 'warn', 'backup.restore_refused', `${req.subject.login} tried to restore a backup file that belongs to a different account`, { actor: req.subject.login, accountId: req.subject.account_id });
      return fail(res, 400, 'BACKUP_WRONG_ACCOUNT');
    }
    const p = await makePoint(db, req.subject.account_id, req.subject.login, mode);
    tenantLog(req, 'backup.restore_started', `${req.subject.login} started a restore (${mode === 'replace' ? 'replace everything' : 'add what is missing'}); a safety copy of ${p.count} records was saved for 7 days`, { mode, safetyCopy: p.count });
    res.json({ restorePoint: p });
  });
  r.post('/restore/done', admin, ready, async (req, res) => {
    const c = { added: num(req.body?.added), replaced: num(req.body?.replaced), removed: num(req.body?.removed) };
    tenantLog(req, 'backup.restore_done', `${req.subject.login} finished a restore: ${c.added} added, ${c.replaced} replaced, ${c.removed} removed`, c);
    res.json({ ok: true });
  });
  // Puts everything back as it was before the restore (also used by the browser when a restore fails part-way).
  r.post('/undo', admin, ready, async (req, res) => {
    const p = await undoPoint(db, req.subject.account_id); if (!p) return fail(res, 404, 'BACKUP_NO_RESTORE_POINT');
    const failed = !!req.body?.failed;
    log('tenant', failed ? 'warn' : 'info', failed ? 'backup.restore_rolled_back' : 'backup.restore_undone', failed ? `A restore by ${req.subject.login} did not finish, so the account was put back as it was (${p.count} records)` : `${req.subject.login} undid the last restore (${p.count} records back as before)`, { actor: req.subject.login, accountId: req.subject.account_id, data: { count: p.count } });
    res.json({ ok: true, count: p.count });
  });
  return r;
}
export const diagnosticsRoutes = (db) => express.Router().get('/', need('users.manage'), async (req, res) => res.json({ text: await buildDiagnostics(db, req.subject, req.get('user-agent')) }));
