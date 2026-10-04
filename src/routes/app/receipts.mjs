// ROUTES / app / receipts — email a receipt to a customer. The server relays it and forgets it: nothing about the message is saved
// (only a count per account per day, to stop misuse), and the log records the fact that one was sent, never the address or content.
import express from 'express';
import { need, tenantLog } from './context.mjs';
import { render, TEMPLATES, PLACEHOLDERS, EDITABLE, defaultsOf, wording, problems } from '../../services/mail/templates.mjs';
import { LOGO_CID } from '../../services/mail/theme.mjs';
import { newId } from '../../core/ids.mjs';
import { getSetting } from '../../db/settings.mjs';
import { sendDirect, mailReady } from '../../services/mail/index.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { checkOwnSmtp, sendOwn, ownErrorCode } from '../../services/mail/own.mjs';
import { fail } from '../../core/messages.mjs';

const L = areaLogger('mail');
export const DAILY_LIMIT = 100, OWN_DAILY_LIMIT = 1000;

// The messages a reseller may reword, the picture they may add, and what a preview looks like.
const KEYS = ['receipt', 'own_mail_test'];
const MAGIC = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/gif': [0x47, 0x49, 0x46], 'image/webp': [0x52, 0x49, 0x46, 0x46] };
// A logo arrives as a data URL; returns an email attachment, null (none), or false (not acceptable).
export function parseLogo(v) {
  if (!v) return null;
  const m = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(v)); if (!m) return false;
  const buf = Buffer.from(m[2], 'base64'); if (buf.length < 20 || buf.length > 150 * 1024 || !MAGIC[m[1]].every((b, i) => buf[i] === b)) return false;
  return { filename: 'logo.' + m[1].split('/')[1], content: buf, contentType: m[1], cid: LOGO_CID };
}
// A reseller's wording for one message (subject, heading, body) checked against the same rules as the Host administrator's.
function wordingOf(key, w) {
  if (!w || typeof w !== 'object') return { override: {} };
  const o = Object.fromEntries(['subject', 'title', 'body'].filter(k => typeof w[k] === 'string').map(k => [k, w[k]])), bad = problems(key, { ...wording(key, null), ...o, buttonLabel: '' });
  return bad.length ? { error: bad[0] } : { override: o };
}
const sampleReceipt = (b) => `${b}\nReceipt S-20261004-7K2Q\n4 Oct 2026, 2:15 PM\nCustomer: Alex Customer\n\nvSeeBox V6 Plus  $340.00\n   UID: 273D00000019D128\n\nTotal: $340.00\nPaid by: Card\n90 days warranty\n\nThank you!`;

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
  const previews = new Map(); // short-lived rendered drafts so the preview frame can load them as a real page with its own security headers
  // Which messages can be reworded, with the wording they would otherwise get (the site's, as the Host administrator set it).
  r.get('/templates', need('users.manage'), async (req, res) => {
    const saved = await getSetting(db, 'mail_templates', {});
    res.json({ templates: KEYS.map(k => { const t = TEMPLATES[k], d = defaultsOf(t), cur = wording(k, saved[k]);
      return { key: k, name: t.name, current: { subject: cur.subject, title: cur.title, body: cur.body }, placeholders: t.vars.map(v => ({ key: v, label: PLACEHOLDERS[v].label, required: t.required.includes(v) })), defaults: { subject: d.subject, title: d.title, body: d.body } }; }) });
  });
  r.post('/preview', need('users.manage'), async (req, res) => {
    const key = String(req.body.key || ''); if (!KEYS.includes(key)) return fail(res, 400, 'MAIL_WORDING_BAD');
    const logo = parseLogo(req.body.logo); if (logo === false) return fail(res, 400, 'MAIL_LOGO_BAD');
    const w = wordingOf(key, req.body.wording), saved = (await getSetting(db, 'mail_templates', {}))[key], b = req.subject.business_name;
    const draft = Object.fromEntries(['subject', 'title', 'body'].map(k => [k, typeof req.body.wording?.[k] === 'string' ? req.body.wording[k] : undefined]).filter(x => x[1] !== undefined));
    const m = render(key, { business: b, receiptNo: 'S-20261004-7K2Q', message: sampleReceipt(b) }, { ...saved, ...draft }, { name: b, logo: !!logo }), token = newId();
    previews.set(token, { account: req.subject.account_id, html: logo ? m.html.replace(`cid:${LOGO_CID}`, `data:${logo.contentType};base64,${logo.content.toString('base64')}`) : m.html });
    while (previews.size > 40) previews.delete(previews.keys().next().value);
    res.json({ subject: m.subject, text: m.text, token, problems: w.error ? [w.error] : [] });
  });
  r.get('/preview/:token', need('users.manage'), (req, res) => {
    const p = previews.get(String(req.params.token)); if (!p || p.account !== req.subject.account_id) return res.status(404).send('Preview expired.');
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' }); res.send(p.html);
  });
  const valid = (to) => /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/.test(to) && to.length <= 200;
  // body.smtp = the reseller's own mail server details (used once, not kept); without it the site's shared sender is used.
  async function relay(req, res, to, m, tmplLog, attachments) {
    const u = req.subject;
    if (req.body.smtp) {
      const c = await checkOwnSmtp(req.body.smtp); if (c.code) return fail(res, 400, c.code);
      if (!await count(u.account_id, OWN_DAILY_LIMIT)) return fail(res, 429, 'RECEIPT_MAIL_LIMIT');
      try { await sendOwn(c.smtp, { to, subject: m.subject, text: m.text, html: m.html, attachments }); }
      catch (e) { const code = ownErrorCode(e); L.warn('receipt.failed', `A message could not be sent for ${u.login} through their own mail server (${code})`, { actor: u.login, accountId: u.account_id }); return fail(res, 502, code); }
      tenantLog(req, tmplLog, `${u.login} sent a message through their own mail server`); return res.json({ ok: true, via: 'own' });
    }
    if (!await mailReady(db)) return fail(res, 400, 'RECEIPT_MAIL_OFF');
    if (!await count(u.account_id, DAILY_LIMIT)) return fail(res, 429, 'RECEIPT_MAIL_LIMIT');
    try { await sendDirect(db, { to, subject: m.subject, text: m.text, html: m.html, replyTo: u.email || undefined, businessName: u.business_name, attachments }); }
    catch (e) { L.warn('receipt.failed', `A message could not be sent for ${u.login}: ${e.message === 'mail_off' ? 'email is off' : 'the mail server refused it'}`, { actor: u.login, accountId: u.account_id }); return fail(res, 502, 'RECEIPT_MAIL_FAILED'); }
    tenantLog(req, tmplLog, `${u.login} sent a message`); res.json({ ok: true, via: 'site' });
  }
  // Builds the message with the reseller's own wording and logo (checked), then sends it.
  async function build(req, res, key, vars) {
    const u = req.subject, logo = parseLogo(req.body.logo); if (logo === false) { fail(res, 400, 'MAIL_LOGO_BAD'); return null; }
    const w = wordingOf(key, req.body.wording); if (w.error) { res.status(400).json({ error: w.error, code: 'MAIL_WORDING_BAD' }); return null; }
    const saved = (await getSetting(db, 'mail_templates', {}))[key];
    return { m: render(key, { business: u.business_name, ...vars }, { ...saved, ...w.override }, { name: u.business_name, logo: !!logo }), attachments: logo ? [logo] : [] };
  }
  r.post('/', need('sales.read'), async (req, res) => {
    const to = String(req.body.to || '').trim(), no = String(req.body.receiptNo || '').slice(0, 40), text = String(req.body.text || '');
    if (!valid(to) || !text.trim() || text.length > 20000) return fail(res, 400, 'RECEIPT_MAIL_BAD');
    const b = await build(req, res, 'receipt', { receiptNo: no, message: text }); if (b) await relay(req, res, to, b.m, 'receipt.emailed', b.attachments);
  });
  // Sends a short test to the person who is signed in (or an address they give) so they can check their own mail server details.
  r.post('/test', need('users.manage'), async (req, res) => {
    const u = req.subject, to = String(req.body.to || u.email || '').trim(); if (!valid(to)) return fail(res, 400, 'RECEIPT_MAIL_BAD');
    const b = await build(req, res, 'own_mail_test', {}); if (b) await relay(req, res, to, b.m, 'mail.own_tested', b.attachments);
  });
  return r;
}
