// ROUTES / app / email — confirm or change the signed-in person's email address.
import express from 'express';
import { tenantLog } from './context.mjs';
import { verifyPassword } from '../../auth/password.mjs';
import { sendConfirmation, mailReady } from '../../services/verify/index.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';

const REASONS = { mail_off: 'Email is not set up on this site, so a confirmation cannot be sent.', too_soon: 'A message was just sent. Please wait a minute before asking for another.', daily_limit: 'Too many messages today. Please try again tomorrow.' };

export function emailRoutes(db) {
  const r = express.Router();
  r.post('/resend', async (req, res) => {
    const u = req.subject; if (!u.email) return res.status(400).json({ error: 'There is no email address on your account yet.' });
    if (u.email_verified_at) return res.json({ ok: true, alreadyConfirmed: true });
    const s = await sendConfirmation(db, u, u.email, { accountCode: u.account_code, ip: normalizeIp(req.ip) });
    if (!s.sent) return res.status(s.reason === 'mail_off' ? 400 : 429).json({ error: REASONS[s.reason] });
    tenantLog(req, 'email.confirmation_resent', `${u.login} asked for the confirmation email again`); res.json({ ok: true });
  });
  // A new address only replaces the old one once it has been confirmed from the new mailbox.
  r.post('/change', async (req, res) => {
    const u = req.subject, email = String(req.body.email || '').trim().slice(0, 200);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!verifyPassword(String(req.body.password || ''), u.pw_hash)) return res.status(400).json({ error: 'That password is not right.' });
    if (!await mailReady(db)) return res.status(400).json({ error: REASONS.mail_off });
    if (email.toLowerCase() === String(u.email || '').toLowerCase()) return res.status(400).json({ error: 'That is already your email address.' });
    const s = await sendConfirmation(db, u, email, { accountCode: u.account_code, ip: normalizeIp(req.ip) });
    if (!s.sent) return res.status(429).json({ error: REASONS[s.reason] });
    tenantLog(req, 'email.change_requested', `${u.login} asked to change their email address (waiting for confirmation)`); res.json({ ok: true });
  });
  return r;
}
