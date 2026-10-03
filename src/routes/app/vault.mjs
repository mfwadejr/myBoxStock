// ROUTES / app / vault — encrypted account data. The server stores and returns ciphertext only; it cannot read any record.
// Permissions are enforced per record type here. Every query is scoped by the signed-in session's account.
import express from 'express';
import { can, need, tenantLog } from './context.mjs';
import { fail } from '../../core/messages.mjs';
import { validKeys, validWrapped, saveKeys, vaultEnabled } from '../../services/vault/keys.mjs';

// config = the account's field and checklist setup. Anyone who can read business data can read it; only Administrators change it.
const TYPES = { item: 'inventory', model: 'inventory', customer: 'customers', sale: 'sales', config: 'config' };
const ID = /^[A-Za-z0-9_-]{8,64}$/, MAX_OPS = 500, MAX_BLOB = 64 * 1024;
const allowed = (req, type, mode) => {
  if (!TYPES[type]) return false;
  if (type === 'config') return mode === 'read' ? ['inventory.read', 'sales.read', 'customers.read'].some(p => can(req.subject.perms, p)) : can(req.subject.perms, 'users.manage');
  return can(req.subject.perms, `${TYPES[type]}.${mode}`);
};

export function vaultRoutes(db) {
  const r = express.Router();
  const ready = async (req, res, next) => (await vaultEnabled(db, req.subject.account_id)) ? next() : fail(res, 409, 'VAULT_NOT_READY');

  // First-time setup (Administrator). Also how existing accounts move to encrypted storage.
  r.post('/enable', need('users.manage'), async (req, res) => {
    const { keys, recoveryWrappedAdk } = req.body || {};
    if (!validKeys(keys) || !validWrapped(recoveryWrappedAdk)) return fail(res, 400, 'VAULT_BAD_KEYS');
    if (await vaultEnabled(db, req.subject.account_id)) return fail(res, 409, 'VAULT_ALREADY_ON');
    await db.tx(async (t) => { await t.run('INSERT INTO account_recovery (account_id, wrapped_adk, created_at) VALUES (?,?,?)', [req.subject.account_id, recoveryWrappedAdk, Date.now()]); });
    await saveKeys(db, req.subject, keys);
    tenantLog(req, 'vault.enabled', `${req.subject.login} turned on encryption for the account`);
    res.json({ ok: true });
  });
  r.get('/recovery', ready, async (req, res) => { const x = await db.get('SELECT wrapped_adk FROM account_recovery WHERE account_id = ?', [req.subject.account_id]); res.json({ wrappedAdk: x.wrapped_adk }); });
  r.post('/recovery/confirm', need('users.manage'), ready, async (req, res) => {
    await db.run('UPDATE account_recovery SET confirmed_at = ? WHERE account_id = ?', [Date.now(), req.subject.account_id]);
    tenantLog(req, 'vault.recovery_confirmed', `${req.subject.login} confirmed the recovery key is saved`); res.json({ ok: true });
  });
  r.post('/recovery/rotate', need('users.manage'), ready, async (req, res) => {
    if (!validWrapped(req.body?.recoveryWrappedAdk)) return fail(res, 400, 'VAULT_BAD_KEYS');
    await db.run('UPDATE account_recovery SET wrapped_adk = ?, confirmed_at = NULL, rotated_at = ? WHERE account_id = ?', [req.body.recoveryWrappedAdk, Date.now(), req.subject.account_id]);
    tenantLog(req, 'vault.recovery_replaced', `${req.subject.login} created a new recovery key`); res.json({ ok: true });
  });
  // After regaining access with the recovery key, a person re-wraps the account key under their current password.
  r.put('/keys/me', ready, async (req, res) => {
    if (!validKeys(req.body?.keys)) return fail(res, 400, 'VAULT_BAD_KEYS');
    await saveKeys(db, req.subject, req.body.keys); tenantLog(req, 'vault.keys_updated', `${req.subject.login} restored their own access`); res.json({ ok: true });
  });

  // Plaintext items from before encryption existed — readable once by an Administrator so the browser can encrypt them, then removed.
  r.get('/legacy', need('users.manage'), async (req, res) => res.json(await db.all('SELECT id, uid, serial, mac, model, cond, cost, status, notes, created_at FROM inventory_items WHERE account_id = ? ORDER BY created_at', [req.subject.account_id])));
  r.post('/legacy/clear', need('users.manage'), ready, async (req, res) => {
    const n = await db.run('DELETE FROM inventory_items WHERE account_id = ?', [req.subject.account_id]);
    tenantLog(req, 'vault.legacy_cleared', `${req.subject.login} finished moving ${n.changes} older items into encrypted storage`, { count: n.changes }); res.json({ ok: true });
  });

  r.get('/records', ready, async (req, res) => {
    const types = Object.keys(TYPES).filter(t => allowed(req, t, 'read')); if (!types.length) return res.json({ records: [] });
    const rows = await db.all(`SELECT id, type, blob, rev, updated_at FROM records WHERE account_id = ? AND type IN (${types.map(() => '?').join(',')}) ORDER BY created_at`, [req.subject.account_id, ...types]);
    res.json({ records: rows.map(x => ({ ...x, rev: Number(x.rev), updated_at: Number(x.updated_at) })) });
  });

  // One transaction: puts (create with rev 0, change with the rev you read) and deletes. A stale rev is refused, so edits never overwrite each other.
  r.post('/batch', ready, async (req, res) => {
    const puts = Array.isArray(req.body?.puts) ? req.body.puts : [], dels = Array.isArray(req.body?.deletes) ? req.body.deletes : [];
    if (puts.length + dels.length === 0 || puts.length + dels.length > MAX_OPS) return fail(res, 400, 'RECORD_BAD');
    for (const p of puts) {
      if (!ID.test(p?.id || '') || !TYPES[p.type] || typeof p.blob !== 'string' || !/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(p.blob) || !Number.isInteger(p.rev) || p.rev < 0) return fail(res, 400, 'RECORD_BAD');
      if (p.blob.length > MAX_BLOB) return fail(res, 413, 'RECORD_TOO_BIG');
      if (!allowed(req, p.type, 'write')) return fail(res, 403, 'PERMISSION_DENIED');
    }
    for (const d of dels) if (!ID.test(d?.id || '')) return fail(res, 400, 'RECORD_BAD');
    const acc = req.subject.account_id, now = Date.now(), out = []; let conflict = false, denied = false;
    await db.tx(async (t) => {
      for (const p of puts) {
        const cur = await t.get('SELECT rev, type FROM records WHERE id = ? AND account_id = ?', [p.id, acc]);
        if (p.rev === 0) { if (cur) { conflict = true; throw new Error('rollback'); } if (await t.get('SELECT id FROM records WHERE id = ?', [p.id])) { conflict = true; throw new Error('rollback'); } await t.run('INSERT INTO records (id, account_id, type, blob, rev, created_at, updated_at) VALUES (?,?,?,?,1,?,?)', [p.id, acc, p.type, p.blob, now, now]); out.push({ id: p.id, rev: 1, updated_at: now }); }
        else { if (!cur || Number(cur.rev) !== p.rev || cur.type !== p.type) { conflict = true; throw new Error('rollback'); } await t.run('UPDATE records SET blob = ?, rev = ?, updated_at = ? WHERE id = ? AND account_id = ?', [p.blob, p.rev + 1, now, p.id, acc]); out.push({ id: p.id, rev: p.rev + 1, updated_at: now }); }
      }
      for (const d of dels) {
        const cur = await t.get('SELECT type FROM records WHERE id = ? AND account_id = ?', [d.id, acc]); if (!cur) continue;
        if (!allowed(req, cur.type, 'write')) { denied = true; throw new Error('rollback'); }
        await t.run('DELETE FROM records WHERE id = ? AND account_id = ?', [d.id, acc]);
      }
    }).catch((e) => { if (e.message !== 'rollback') throw e; });
    if (denied) return fail(res, 403, 'PERMISSION_DENIED');
    if (conflict) return fail(res, 409, 'RECORD_CONFLICT');
    tenantLog(req, 'records.saved', `${req.subject.login} saved ${puts.length} and removed ${dels.length} records`, { puts: puts.length, deletes: dels.length }); // counts only
    res.json({ records: out });
  });
  return r;
}
