// ROUTES / app / receipts — email a receipt to a customer. The server relays it and forgets it: nothing about the message is saved
// (only a count per account per day, to stop misuse), and the log records the fact that one was sent, never the address or content.
import express from 'express';
import { need, tenantLog } from './context.mjs';
import { render } from '../../services/mail/templates.mjs';
import { getSetting } from '../../db/settings.mjs';
import { sendDirect, mailReady } from '../../services/mail/index.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { fail } from '../../core/messages.mjs';

const L = areaLogger('mail');
export const DAILY_LIMIT = 100;
const today = () => new Date().toISOString().slice(0, 10);

export function receiptRoutes(db) {
  const r = express.Router();
  r.post('/', need('sales.read'), async (req, res) => {
    const u = req.subject, to = String(req.body.to || '').trim(), no = String(req.body.receiptNo || '').slice(0, 40), text = String(req.body.text || '');
    if (!/^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/.test(to) || to.length > 200 || !text.trim() || text.length > 20000) return fail(res, 400, 'RECEIPT_MAIL_BAD');
    if (!await mailReady(db)) return fail(res, 400, 'RECEIPT_MAIL_OFF');
    const day = today(), row = await db.get('SELECT n FROM receipt_mail_usage WHERE account_id = ? AND day = ?', [u.account_id, day]);
    if (Number(row?.n || 0) >= DAILY_LIMIT) return fail(res, 429, 'RECEIPT_MAIL_LIMIT');
    if (row) await db.run('UPDATE receipt_mail_usage SET n = n + 1 WHERE account_id = ? AND day = ?', [u.account_id, day]); else await db.run('INSERT INTO receipt_mail_usage (account_id, day, n) VALUES (?,?,1)', [u.account_id, day]);
    const saved = (await getSetting(db, 'mail_templates', {})).receipt, m = render('receipt', { business: u.business_name, receiptNo: no, message: text }, saved);
    try { await sendDirect(db, { to, subject: m.subject, text: m.text, html: m.html, replyTo: u.email || undefined, businessName: u.business_name }); }
    catch (e) { L.warn('receipt.failed', `A receipt could not be sent for ${u.login}: ${e.message === 'mail_off' ? 'email is off' : 'the mail server refused it'}`, { actor: u.login, accountId: u.account_id }); return fail(res, 502, 'RECEIPT_MAIL_FAILED'); }
    tenantLog(req, 'receipt.emailed', `${u.login} emailed a receipt`); res.json({ ok: true });
  });
  return r;
}
