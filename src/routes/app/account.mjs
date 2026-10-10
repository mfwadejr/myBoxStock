// ROUTES / app / account — close the account (7-day locked period, then automatic erase) or restore it. Administrators only.
import express from 'express';
import { need, tenantLog } from './context.mjs';
import { verifyPassword } from '../../auth/password.mjs';
import { startClosing, restoreClosing, GRACE_DAYS } from '../../services/accounts/closing.mjs';
import { fail } from '../../core/messages.mjs';

export function accountRoutes(db) {
  const r = express.Router(), mine = (req) => db.get('SELECT id, account_code, business_name, owner_email, closing_at FROM accounts WHERE id = ?', [req.subject.account_id]);
  r.post('/close', need('users.manage'), async (req, res) => {
    const u = req.subject, a = await mine(req);
    if (a.closing_at) return res.status(400).json({ error: 'This account is already closing.' });
    if (!verifyPassword(String(req.body.password || ''), u.pw_hash) || String(req.body.resellerId || '').trim().toLowerCase() !== String(a.account_code).toLowerCase()) {
      tenantLog(req, 'account.close_refused', `${u.login} tried to close the account but the password or Reseller ID was wrong`);
      return res.status(400).json({ error: 'The password or Reseller ID is not right.' });
    }
    const at = await startClosing(db, a, { actor: u.login, email: u.email });
    tenantLog(req, 'account.close_requested', `${u.login} closed the account: locked now, erases on ${new Date(at).toISOString().slice(0, 10)}`, { eraseAt: at });
    res.json({ ok: true, eraseAt: at, days: GRACE_DAYS });
  });
  r.post('/restore', need('users.manage'), async (req, res) => {
    const a = await mine(req); if (!a.closing_at) return fail(res, 400, 'NOT_CLOSING');
    await restoreClosing(db, a, { actor: req.subject.login });
    tenantLog(req, 'account.restore_requested', `${req.subject.login} cancelled the closing of the account`); res.json({ ok: true });
  });
  // The export and the customer erase happen in the browser; these only leave a note in the log (counts, never contents).
  r.post('/export-note', need('users.manage'), (req, res) => { tenantLog(req, 'data.exported', `${req.subject.login} exported all account data (built in their browser)`); res.json({ ok: true }); });
  // The first-run checklist (Home): the browser says the checklist was dismissed. Events only; the ticks themselves are worked out in the browser.
  const FIRSTRUN = { dismissed: 'dismissed the first-run checklist' };
  r.post('/firstrun-note', need('users.manage'), (req, res) => {
    const e = String(req.body?.event || ''); if (!Object.hasOwn(FIRSTRUN, e)) return fail(res, 400, 'FIRSTRUN_BAD');
    tenantLog(req, `firstrun.${e}`, `${req.subject.login}: ${FIRSTRUN[e]}`); res.json({ ok: true });
  });
  r.post('/erase-note', need('customers.write'), (req, res) => { tenantLog(req, 'customer.erased', `${req.subject.login} erased one customer's personal details (${Math.max(0, Number(req.body.sales) || 0)} sales kept)`, { sales: Number(req.body.sales) || 0 }); res.json({ ok: true }); });
  // Returns and refunds happen in the browser (the records are encrypted); this only leaves a note in the log: who, what kind, how many devices, how much. Never names or contents.
  const RETURN_EVENTS = { processed: 'processed a return', requested: 'asked an Administrator to process a return' };
  r.post('/return-note', need('sales.write'), (req, res) => {
    const e = String(req.body?.event || ''); if (!Object.hasOwn(RETURN_EVENTS, e)) return fail(res, 400, 'RETURN_BAD');
    const devices = Math.min(500, Math.max(0, Math.floor(Number(req.body.devices) || 0))), cents = Math.min(1e9, Math.max(0, Math.round(Number(req.body.cents) || 0))), full = req.body.full === true;
    tenantLog(req, `sale.return_${e}`, `${req.subject.login} (${req.subject.role}) ${RETURN_EVENTS[e]}: ${devices} device${devices === 1 ? '' : 's'}${e === 'processed' ? `, refund ${(cents / 100).toFixed(2)}${full ? ', whole sale' : ', part of a sale'}` : ''}`, { devices, cents, full });
    res.json({ ok: true });
  });
  return r;
}
