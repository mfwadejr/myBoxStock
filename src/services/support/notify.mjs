// SERVICES / support / notify — instant notice to the Host when a reseller opens a ticket (or replies on one waiting on the Host).
// Two channels: an alert in Host > Alerts (links to the ticket, clears when the ticket is opened or replied to) and an email through the Host Email setup.
// Safeguards: the threshold, the recipient list, an emails-per-hour cap, an optional daily digest, and every notice written to the audit trail.
// The email holds the reseller name, priority, category and the first lines of the message, never screenshots or diagnostics.
import { areaLogger } from '../../logging/logger.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { enqueueMail, processQueue, mailReady } from '../mail/index.mjs';
import { siteUrl } from '../site/index.mjs';
import { raise, resolve } from '../alerts/index.mjs';
import { getSupportSettings } from './settings.mjs';
import { AWAITING_HOST } from './tickets.mjs';

const L = areaLogger('host');
const HOUR = 3600e3, DAY = 86400e3, STATE = 'support_notify_state';
export const ticketKey = (n) => `support.ticket.${n}`, replyKey = (n) => `support.reply.${n}`;
const isHigh = (p) => /^(high|urgent)$/i.test(String(p || ''));
const excerpt = (body) => { const t = String(body || '').replace(/\r\n?/g, '\n').trim().split('\n').filter(l => l.trim()).slice(0, 3).join('\n'); return t.length > 300 ? t.slice(0, 297) + '...' : t; };

// One writer at a time for the small state record (the hourly send times and the last digest time).
let chain = Promise.resolve();
const withState = (db, fn) => { const run = chain.then(async () => { const st = { sent: [], lastDigestAt: 0, ...(await getSetting(db, STATE, {})) }; const out = await fn(st); await setSetting(db, STATE, st); return out; }); chain = run.catch(() => {}); return run; };

// Who gets the email: the Owner (oldest administrator), every administrator, or a chosen list. Only those with an address.
export async function recipients(db, s) {
  const rows = await db.all("SELECT id, email, username FROM host_admins WHERE email IS NOT NULL AND email <> '' ORDER BY created_at, id");
  if (s.notifyRecipients === 'owner') { const first = await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1'); return rows.filter(r => r.id === first?.id); }
  if (s.notifyRecipients === 'chosen') return rows.filter(r => s.notifyChosen.includes(r.id));
  return rows;
}
// Takes up to `want` places under the hourly cap; returns how many were granted.
const reserve = (db, s, want) => withState(db, (st) => { const now = Date.now(); st.sent = st.sent.filter(t => t > now - HOUR); const n = Math.max(0, Math.min(want, s.notifyPerHour - st.sent.length)); for (let i = 0; i < n; i++) st.sent.push(now); return n; });

const skip = (reason, label, data = {}) => L.info('support.notice_skipped', `Support notice for ${label} not sent by email: ${reason}`, { actor: 'system', data: { ticket: label, reason, ...data } });
const queue = async (db, to, template, vars) => { await enqueueMail(db, to, template, vars); processQueue(db).catch(() => {}); };

// kind: 'new' (a ticket was opened) or 'reply' (the reseller answered a ticket now waiting on the Host). Never throws: a failed notice must not fail the reseller's request.
export async function ticketNotice(db, number, kind = 'new') {
  const out = { alert: false, emails: 0, skipped: null };
  try {
    const t = await db.get('SELECT * FROM support_tickets WHERE number = ?', [Number(number)]); if (!t) return out;
    const s = await getSupportSettings(db), label = `#${t.number}`, isNew = kind === 'new';
    if (s.notifyThreshold === 'high' && !isHigh(t.priority)) { out.skipped = 'threshold'; skip('below the threshold (only High and Urgent)', label); return out; }
    const inApp = isNew ? s.notifyInApp : s.notifyReplyInApp, email = isNew ? s.notifyEmail : s.notifyReplyEmail;
    const who = t.account_name || 'a reseller', msg = await db.get("SELECT body FROM support_messages WHERE ticket_id = ? AND side = 'requester' AND internal = 0 ORDER BY ts DESC, id DESC LIMIT 1", [t.id]);
    if (inApp) {
      const title = (isNew ? `New ticket ${label} from ${who}: ${t.subject} (${t.priority} priority)` : `Reseller replied on ticket ${label} from ${who}: ${t.subject}`).slice(0, 250);
      await raise(db, { kind: isNew ? 'support.ticket' : 'support.reply', key: isNew ? ticketKey(t.number) : replyKey(t.number), level: isHigh(t.priority) ? 'error' : 'info', title, detail: `${t.category}. ${excerpt(msg?.body).split('\n')[0] || ''}`.slice(0, 300), mail: false });
      out.alert = true; L.info('support.notice', `Alert raised for ticket ${label} (${isNew ? 'new ticket' : 'reseller reply'}, ${t.priority})`, { actor: 'system', accountId: t.account_id, data: { ticket: label, kind, priority: t.priority } });
    }
    if (!email) return out;
    if (!await mailReady(db)) { out.skipped = 'mail_off'; skip('Email is not set up', label, { code: 'SUPPORT_NOTIFY_MAIL_OFF' }); return out; }
    if (s.notifyDigest) { skip('the daily digest will carry it', label); return out; }
    const to = await recipients(db, s); if (!to.length) { out.skipped = 'no_recipients'; skip('no recipient has an email address', label); return out; }
    const granted = await reserve(db, s, to.length), url = `${await siteUrl(db)}/host/#/support/${t.number}`;
    for (const r of to.slice(0, granted)) {
      await queue(db, r.email, isNew ? 'support_new_ticket' : 'support_requester_reply', { ticketNo: label, ticketSubject: t.subject, reseller: who, priority: t.priority, category: t.category, excerpt: excerpt(msg?.body), url });
      out.emails++; L.info('support.notice_email', `Notice email for ticket ${label} queued for ${r.username}`, { actor: 'system', accountId: t.account_id, data: { ticket: label, to: r.email, kind } });
    }
    if (granted < to.length) { out.skipped = 'cap'; skip(`the limit of ${s.notifyPerHour} notice emails an hour is reached`, label, { code: 'SUPPORT_NOTIFY_CAPPED', left: to.length - granted }); }
  } catch (e) { L.error('support.notice_failed', `Could not send the support notice for ticket #${number}: ${e.message}`, { actor: 'system', data: { ticket: `#${number}`, code: 'SUPPORT_NOTIFY_FAILED' } }); out.skipped = 'error'; }
  return out;
}

// The ticket was opened or answered by the Host: its alerts are done.
export async function clearTicketAlerts(db, number) { await resolve(db, ticketKey(number)); await resolve(db, replyKey(number)); }

// Once a day (when the digest is on): one email listing the new tickets and reseller replies since the last one. Called by the alert check every 5 minutes.
export async function sendDigest(db, now = Date.now()) {
  const s = await getSupportSettings(db); if (!s.notifyDigest || !(s.notifyEmail || s.notifyReplyEmail)) return { sent: 0 };
  const due = await withState(db, (st) => { if (!st.lastDigestAt) { st.lastDigestAt = now; return null; } if (now - st.lastDigestAt < DAY) return null; const since = st.lastDigestAt; st.lastDigestAt = now; return since; });
  if (due == null) return { sent: 0 };
  const rows = await db.all(`SELECT * FROM support_tickets WHERE status IN (${AWAITING_HOST.map(() => '?').join(',')}) AND (created_at > ? OR last_requester_at > ?) ORDER BY number`, [...AWAITING_HOST, due, due]);
  const items = rows.filter(t => (s.notifyThreshold === 'every' || isHigh(t.priority)) && (Number(t.created_at) > due ? s.notifyEmail : s.notifyReplyEmail));
  if (!items.length) return { sent: 0 };
  if (!await mailReady(db)) { skip('Email is not set up', 'the daily digest', { code: 'SUPPORT_NOTIFY_MAIL_OFF' }); return { sent: 0 }; }
  const to = await recipients(db, s), granted = await reserve(db, s, to.length), url = `${await siteUrl(db)}/host/#/support`;
  const lines = items.slice(0, 50).map(t => `#${t.number} · ${t.account_name || 'a reseller'} · ${t.priority} · ${t.subject}${Number(t.created_at) > due ? '' : ' (reply)'}`).join('\n') + (items.length > 50 ? `\nand ${items.length - 50} more` : '');
  for (const r of to.slice(0, granted)) await queue(db, r.email, 'support_digest', { count: String(items.length), lines, url });
  L.info('support.notice_digest', `Daily support digest queued: ${items.length} ticket${items.length === 1 ? '' : 's'}, ${Math.min(granted, to.length)} recipient${granted === 1 ? '' : 's'}`, { actor: 'system', data: { tickets: items.length, recipients: Math.min(granted, to.length) } });
  if (granted < to.length) skip(`the limit of ${s.notifyPerHour} notice emails an hour is reached`, 'the daily digest', { code: 'SUPPORT_NOTIFY_CAPPED' });
  return { sent: Math.min(granted, to.length), tickets: items.length };
}
