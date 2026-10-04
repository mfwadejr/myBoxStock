// ROUTES / app / receipts — email a receipt to a customer. The server relays it and forgets it: nothing about the message is saved
// (only a count per account per day, to stop misuse), and the log records the fact that one was sent, never the address or content.
import express from 'express';
import { need, tenantLog } from './context.mjs';
import { render } from '../../services/mail/templates.mjs';
import { getSetting } from '../../db/settings.mjs';
import { sendDirect, mailReady } from '../../services/mail/index.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { checkOwnSmtp, sendOwn, ownErrorCode } from '../../services/mail/own.mjs';
import { fail } from '../../core/messages.mjs';

const L = areaLogger('mail');
export const DAILY_LIMIT = 100, OWN_DAILY_LIMIT = 1000;
const today = () => new Date().toISOString().slice(0, 10);

export function receiptRoutes(db) {
  const r = express.Router();
  // Counts a message for today; false when the account has reached its limit.
  const count = async (accountId, limit) => {
    const day = today(), row = await db.get('SELECT n FROM receipt_mail_usage WHERE account_id = ? AND day = ?', [accountId, day]);
    if (Number(row?.n || 0) >= limit) return false;
    if (row) await db.run('UPDATE receipt_mail_usage SET n = n + 1 WHERE account_id = ? AND day = ?', [accountId, day]); else await db.run('INSERT INTO receipt_mail_usage (account_id, day, n) VALUES (?,?,1)', [accountId, day]);
    return true;
  };
  const valid = (to) => /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/.test(to) && to.length <= 200;
  // body.smtp = the reseller's own mail server details (used once, not kept); without it the site's shared sender is used.
  async function relay(req, res, to, m, tmplLog) {
    const u = req.subject;
    if (req.body.smtp) {
      const c = await checkOwnSmtp(req.body.smtp); if (c.code) return fail(res, 400, c.code);
      if (!await count(u.account_id, OWN_DAILY_LIMIT)) return fail(res, 429, 'RECEIPT_MAIL_LIMIT');
      try { await sendOwn(c.smtp, { to, subject: m.subject, text: m.text, html: m.html }); }
      catch (e) { const code = ownErrorCode(e); L.warn('receipt.failed', `A message could not be sent for ${u.login} through their own mail server (${code})`, { actor: u.login, accountId: u.account_id }); return fail(res, 502, code); }
      tenantLog(req, tmplLog, `${u.login} sent a message through their own mail server`); return res.json({ ok: true, via: 'own' });
    }
    if (!await mailReady(db)) return fail(res, 400, 'RECEIPT_MAIL_OFF');
    if (!await count(u.account_id, DAILY_LIMIT)) return fail(res, 429, 'RECEIPT_MAIL_LIMIT');
    try { await sendDirect(db, { to, subject: m.subject, text: m.text, html: m.html, replyTo: u.email || undefined, businessName: u.business_name }); }
    catch (e) { L.warn('receipt.failed', `A message could not be sent for ${u.login}: ${e.message === 'mail_off' ? 'email is off' : 'the mail server refused it'}`, { actor: u.login, accountId: u.account_id }); return fail(res, 502, 'RECEIPT_MAIL_FAILED'); }
    tenantLog(req, tmplLog, `${u.login} sent a message`); res.json({ ok: true, via: 'site' });
  }
  r.post('/', need('sales.read'), async (req, res) => {
    const u = req.subject, to = String(req.body.to || '').trim(), no = String(req.body.receiptNo || '').slice(0, 40), text = String(req.body.text || '');
    if (!valid(to) || !text.trim() || text.length > 20000) return fail(res, 400, 'RECEIPT_MAIL_BAD');
    const saved = (await getSetting(db, 'mail_templates', {})).receipt;
    await relay(req, res, to, render('receipt', { business: u.business_name, receiptNo: no, message: text }, saved), 'receipt.emailed');
  });
  // Sends a short test to the person who is signed in (or an address they give) so they can check their own mail server details.
  r.post('/test', need('users.manage'), async (req, res) => {
    const u = req.subject, to = String(req.body.to || u.email || '').trim(); if (!valid(to)) return fail(res, 400, 'RECEIPT_MAIL_BAD');
    await relay(req, res, to, render('own_mail_test', { business: u.business_name }), 'mail.own_tested');
  });
  return r;
}
