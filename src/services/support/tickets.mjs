// SERVICES / support / tickets — internal support tickets: opening, replying, statuses, the response-target clock, auto-close and purge.
// Written by signed-in resellers, read by the Host. Nothing here touches an account's encrypted data.
import { newId } from '../../core/ids.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { config } from '../../core/config.mjs';
import { describeDevice } from '../signins/device.mjs';
import { coded, claimable, attach } from './attachments.mjs';

const L = areaLogger('host');
const DAY = 86400e3, MIN = 60e3;
export const STATUSES = ['open', 'waiting_host', 'waiting_reseller', 'resolved', 'closed'];
export const STATUS_LABEL = { open: 'Open', waiting_host: 'Waiting on Host', waiting_reseller: 'Waiting on reseller', resolved: 'Resolved', closed: 'Closed' };
export const ACTIVE = ['open', 'waiting_host', 'waiting_reseller'], AWAITING_HOST = ['open', 'waiting_host'];
export const label = (n) => `T-${n}`;
const marks = (list) => list.map(() => '?').join(',');
const TEXT = { subject: [3, 120], message: [5, 8000] };

// ---- the response-target clock: business days (Monday to Friday, UTC) ----
export const isBusinessDay = (ts) => { const d = new Date(ts).getUTCDay(); return d !== 0 && d !== 6; };
export function businessDaysBetween(from, to) { let n = 0; for (let t = Number(from) + DAY; t <= to; t += DAY) if (isBusinessDay(t)) n++; return n; }
export const waitSince = (t) => Number(t.last_requester_at || t.created_at);
export const isOverdue = (t, days, now = Date.now()) => AWAITING_HOST.includes(t.status) && businessDaysBetween(waitSince(t), now) >= days;

// What the page shows as "time waiting": who the ticket is waiting on and since when.
export function waiting(t) {
  if (AWAITING_HOST.includes(t.status)) return { on: 'host', since: waitSince(t) };
  if (t.status === 'waiting_reseller') return { on: 'reseller', since: Number(t.last_host_at || t.updated_at) };
  return { on: null, since: null };
}
const num = (v) => v == null ? null : Number(v);
export const shape = (t, settings = null, now = Date.now()) => ({
  id: t.id, number: Number(t.number), label: label(t.number), subject: t.subject, category: t.category, priority: t.priority, status: t.status, statusLabel: STATUS_LABEL[t.status],
  assigneeId: t.assignee_id || null, accountId: t.account_id || null, accountCode: t.account_code, accountName: t.account_name, requester: t.requester_username, requesterRole: t.requester_role,
  createdAt: Number(t.created_at), updatedAt: Number(t.updated_at), lastHostAt: num(t.last_host_at), lastRequesterAt: num(t.last_requester_at), resolvedAt: num(t.resolved_at), closedAt: num(t.closed_at),
  waiting: waiting(t), overdue: settings ? isOverdue(t, settings.responseDays, now) : false, ...(t.unread !== undefined ? { unread: !!Number(t.unread) } : {}), ...(t.assignee_name !== undefined ? { assignee: t.assignee_name } : {}),
});

const textOf = (v, [lo, hi], code) => { const t = String(v ?? '').replace(/\r\n?/g, '\n').trim(); if (t.length < lo || t.length > hi) throw coded(code); return t; };
const addMsg = async (t, ticketId, { side, internal = 0, author, authorName, body, diagnostics = null, ts = Date.now() }) => {
  const id = newId();
  await t.run('INSERT INTO support_messages (id, ticket_id, ts, side, internal, author_id, author_name, body, diagnostics) VALUES (?,?,?,?,?,?,?,?,?)', [id, ticketId, ts, side, internal ? 1 : 0, author || null, authorName || null, body, diagnostics]);
  return id;
};

// ---- a reseller opens a ticket ----
// user = the signed-in account user row (with account_code / business_name), diagnostics = the text to attach or null.
export async function openTicket(db, user, settings, { category, subject, message, attachmentIds, diagnostics }, ua) {
  const sub = textOf(subject, TEXT.subject, 'SUPPORT_SUBJECT_BAD').replace(/\s+/g, ' '), body = textOf(message, TEXT.message, 'SUPPORT_MESSAGE_BAD');
  if (!settings.categories.includes(String(category))) throw coded('SUPPORT_CATEGORY_BAD');
  const now = Date.now();
  if (Number((await db.get('SELECT COUNT(*) AS n FROM support_tickets WHERE account_id = ? AND created_at > ?', [user.account_id, now - 3600e3])).n) >= settings.perHour) throw coded('SUPPORT_RATE_LIMITED', 429);
  if (Number((await db.get(`SELECT COUNT(*) AS n FROM support_tickets WHERE account_id = ? AND status IN (${marks(ACTIVE)})`, [user.account_id, ...ACTIVE])).n) >= settings.openCap) throw coded('SUPPORT_OPEN_LIMIT', 409);
  const ids = await claimable(db, { kind: 'user', id: user.id }, attachmentIds, settings), id = newId();
  for (let tries = 0; ; tries++) {
    try {
      const number = await db.tx(async (t) => {
        const max = Number((await t.get('SELECT MAX(number) AS n FROM support_tickets')).n || 1000), n = max + 1;
        await t.run(`INSERT INTO support_tickets (id, number, source, account_id, account_code, account_name, requester_id, requester_username, requester_role, requester_email, subject, category, priority, status, app_version, device, created_at, updated_at, last_requester_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, n, 'app', user.account_id, user.account_code, user.business_name, user.id, user.username, user.role, user.email || null, sub, String(category), settings.defaultPriority, 'open', config.version, describeDevice(ua), now, now, now]);
        const mid = await addMsg(t, id, { side: 'requester', author: user.id, authorName: user.username, body, diagnostics, ts: now });
        await attach(t, ids, id, mid);
        return n;
      });
      return { id, number, label: label(number) };
    } catch (e) { if (tries < 3 && /UNIQUE|duplicate/i.test(String(e.message))) continue; throw e; }
  }
}

// ---- a reseller replies ----
export async function requesterReply(db, t, user, settings, { message, attachmentIds, diagnostics }) {
  if (t.status === 'closed') throw coded('SUPPORT_CLOSED', 409);
  const body = textOf(message, TEXT.message, 'SUPPORT_MESSAGE_BAD'), now = Date.now();
  if (Number((await db.get("SELECT COUNT(*) AS n FROM support_messages WHERE author_id = ? AND side = 'requester' AND ts > ?", [user.id, now - 10 * MIN])).n) >= 10) throw coded('SUPPORT_REPLY_LIMITED', 429);
  const ids = await claimable(db, { kind: 'user', id: user.id }, attachmentIds, settings), reopened = t.status === 'resolved';
  const next = t.status === 'waiting_host' ? 'waiting_host' : 'open';
  await db.tx(async (x) => {
    const mid = await addMsg(x, t.id, { side: 'requester', author: user.id, authorName: user.username, body, diagnostics, ts: now });
    await attach(x, ids, t.id, mid);
    if (reopened) await addMsg(x, t.id, { side: 'system', body: 'Reopened by a reply.', ts: now });
    await x.run('UPDATE support_tickets SET status = ?, updated_at = ?, last_requester_at = ?, resolved_at = NULL WHERE id = ?', [next, now, now, t.id]);
  });
  return { reopened, status: next };
}

// ---- the Host replies or leaves a note ----
// internal = a note the reseller never sees. A public reply sets the status (default: Waiting on reseller) and takes the ticket if nobody has it.
export async function hostReply(db, t, admin, settings, { message, internal, status, attachmentIds }) {
  const body = textOf(message, TEXT.message, 'SUPPORT_MESSAGE_BAD'), now = Date.now(), ids = await claimable(db, { kind: 'host', id: admin.id }, attachmentIds, settings);
  if (internal) {
    await db.tx(async (x) => { const mid = await addMsg(x, t.id, { side: 'host', internal: 1, author: admin.id, authorName: admin.username, body, ts: now }); await attach(x, ids, t.id, mid); await x.run('UPDATE support_tickets SET updated_at = ? WHERE id = ?', [now, t.id]); });
    return { internal: true };
  }
  const to = status ? String(status) : 'waiting_reseller'; if (!STATUSES.includes(to)) throw coded('SUPPORT_STATUS_BAD');
  const claimed = !t.assignee_id;
  await db.tx(async (x) => {
    const mid = await addMsg(x, t.id, { side: 'host', author: admin.id, authorName: admin.username, body, ts: now }); await attach(x, ids, t.id, mid);
    if (claimed) await addMsg(x, t.id, { side: 'system', internal: 1, body: `Assigned to ${admin.username} (took the ticket by replying).`, ts: now });
    await x.run('UPDATE support_tickets SET status = ?, updated_at = ?, last_host_at = ?, assignee_id = COALESCE(assignee_id, ?), resolved_at = ?, closed_at = ? WHERE id = ?',
      [to, now, now, admin.id, to === 'resolved' ? now : null, to === 'closed' ? now : null, t.id]);
  });
  return { internal: false, status: to, claimed };
}

// Status, priority, category or assignee changed by the Host. Each change leaves a line in the thread (the status line is visible to the reseller, the rest is Host-only).
export async function change(db, t, admin, field, value, settings) {
  const now = Date.now(); let col = field, shown = String(value), from = t[field], pub = 0;
  if (field === 'status') { if (!STATUSES.includes(value)) throw coded('SUPPORT_STATUS_BAD'); pub = 1; }
  else if (field === 'priority') { if (!settings.priorities.includes(value)) throw coded('SUPPORT_PRIORITY_BAD'); }
  else if (field === 'category') { if (!settings.categories.includes(value) && value !== t.category) throw coded('SUPPORT_CATEGORY_BAD'); }
  else if (field === 'assignee') {
    col = 'assignee_id'; from = t.assignee_id; let who = null;
    if (value) { who = await db.get('SELECT id, username FROM host_admins WHERE id = ?', [value]); if (!who) throw coded('SUPPORT_ASSIGNEE_BAD'); }
    shown = who ? who.username : 'nobody'; value = who ? who.id : null;
    if ((from || null) === value) return { changed: false };
    const old = from ? (await db.get('SELECT username FROM host_admins WHERE id = ?', [from]))?.username || 'someone' : 'nobody';
    await db.tx(async (x) => { await x.run('UPDATE support_tickets SET assignee_id = ?, updated_at = ? WHERE id = ?', [value, now, t.id]); await addMsg(x, t.id, { side: 'system', internal: 1, body: `Assigned to ${shown} (was ${old}) by ${admin.username}.`, ts: now }); });
    return { changed: true, shown, from: old };
  } else throw coded('SUPPORT_STATUS_BAD');
  if (from === value) return { changed: false };
  const sets = [`${col} = ?`, 'updated_at = ?'], args = [value, now];
  if (field === 'status') { sets.push('resolved_at = ?', 'closed_at = ?'); args.push(value === 'resolved' ? now : null, value === 'closed' ? now : null); }
  await db.tx(async (x) => {
    await x.run(`UPDATE support_tickets SET ${sets.join(', ')} WHERE id = ?`, [...args, t.id]);
    await addMsg(x, t.id, { side: 'system', internal: pub ? 0 : 1, body: field === 'status' ? `Status changed to ${STATUS_LABEL[value]}.` : `${field[0].toUpperCase()}${field.slice(1)} changed from ${from} to ${value} by ${admin.username}.`, ts: now });
  });
  return { changed: true, shown, from };
}

// ---- who sees what ----
const SEL = 'SELECT t.*';
export async function listForUser(db, user, isAdmin, { limit = 200 } = {}) {
  const rows = await db.all(`${SEL}, CASE WHEN t.last_host_at IS NOT NULL AND (v.seen_at IS NULL OR v.seen_at < t.last_host_at) THEN 1 ELSE 0 END AS unread
    FROM support_tickets t LEFT JOIN support_views v ON v.ticket_id = t.id AND v.user_id = ? WHERE t.account_id = ?${isAdmin ? '' : ' AND t.requester_id = ?'} ORDER BY t.updated_at DESC LIMIT ${Number(limit)}`, isAdmin ? [user.id, user.account_id] : [user.id, user.account_id, user.id]);
  return rows.map(r => shape(r));
}
export async function unreadCount(db, user, isAdmin) {
  return Number((await db.get(`SELECT COUNT(*) AS n FROM support_tickets t LEFT JOIN support_views v ON v.ticket_id = t.id AND v.user_id = ?
    WHERE t.account_id = ?${isAdmin ? '' : ' AND t.requester_id = ?'} AND t.last_host_at IS NOT NULL AND (v.seen_at IS NULL OR v.seen_at < t.last_host_at)`, isAdmin ? [user.id, user.account_id] : [user.id, user.account_id, user.id])).n);
}
export const findForUser = async (db, user, isAdmin, number) => {
  const t = await db.get('SELECT * FROM support_tickets WHERE number = ? AND account_id = ?', [Number(number) || 0, user.account_id]);
  return t && (isAdmin || t.requester_id === user.id) ? t : null;
};
export const markSeen = (db, ticketId, userId) => db.tx(async (x) => { await x.run('DELETE FROM support_views WHERE ticket_id = ? AND user_id = ?', [ticketId, userId]); await x.run('INSERT INTO support_views (ticket_id, user_id, seen_at) VALUES (?,?,?)', [ticketId, userId, Date.now()]); });

// The conversation. forHost = include internal notes and the real names of Host administrators.
export async function thread(db, ticketId, { forHost }) {
  const msgs = await db.all(`SELECT * FROM support_messages WHERE ticket_id = ?${forHost ? '' : ' AND internal = 0'} ORDER BY ts, id`, [ticketId]);
  const atts = await db.all('SELECT id, message_id, name, mime, size FROM support_attachments WHERE ticket_id = ? ORDER BY created_at', [ticketId]);
  return msgs.map(m => ({ id: m.id, ts: Number(m.ts), side: m.side, internal: !!Number(m.internal), authorId: m.author_id, author: m.side === 'host' && !forHost ? 'myBoxStock support' : m.side === 'system' ? '' : m.author_name || '', body: m.body, diagnostics: m.diagnostics || null,
    attachments: atts.filter(a => a.message_id === m.id).map(a => ({ id: a.id, name: a.name, mime: a.mime, size: Number(a.size) })) }));
}

// ---- the Host list, the counts and the clock ----
export async function awaitingHost(db) { return db.all(`SELECT id, number, status, created_at, last_requester_at, subject FROM support_tickets WHERE status IN (${marks(AWAITING_HOST)})`, AWAITING_HOST); }
export async function overdueTickets(db, settings, now = Date.now()) { return (await awaitingHost(db)).filter(t => isOverdue(t, settings.responseDays, now)).sort((a, b) => waitSince(a) - waitSince(b)); }
export async function summary(db, settings) {
  const by = Object.fromEntries((await db.all('SELECT status, COUNT(*) AS n FROM support_tickets GROUP BY status')).map(r => [r.status, Number(r.n)]));
  const unassigned = Number((await db.get(`SELECT COUNT(*) AS n FROM support_tickets WHERE assignee_id IS NULL AND status IN (${marks(ACTIVE)})`, ACTIVE)).n);
  const last = await db.get('SELECT COUNT(*) AS n, MAX(updated_at) AS u, MAX(number) AS m FROM support_tickets'), overdue = (await overdueTickets(db, settings)).length;
  // `latest` changes whenever a ticket is added, removed, replied to or changed, or the overdue count moves; the live list reloads only when it differs.
  const latest = `${Number(last.n)}.${Number(last.m || 0)}.${Number(last.u || 0)}.${overdue}`;
  return { latest, newest: Number(last.m || 0), open: ACTIVE.reduce((n, s) => n + (by[s] || 0), 0), awaitingHost: AWAITING_HOST.reduce((n, s) => n + (by[s] || 0), 0), resolved: by.resolved || 0, closed: by.closed || 0, unassigned, overdue, responseDays: settings.responseDays };
}

// Resolved tickets close by themselves after the Host's number of days. Returns how many.
export async function autoClose(db, settings, now = Date.now()) {
  const due = await db.all("SELECT id, number, account_id FROM support_tickets WHERE status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at <= ?", [now - settings.autoCloseDays * DAY]);
  for (const t of due) {
    await db.tx(async (x) => { await x.run("UPDATE support_tickets SET status = 'closed', closed_at = ?, updated_at = ? WHERE id = ? AND status = 'resolved'", [now, now, t.id]); await addMsg(x, t.id, { side: 'system', body: `Closed automatically after ${settings.autoCloseDays} day${settings.autoCloseDays === 1 ? '' : 's'} without a reply.`, ts: now }); });
    L.info('support.auto_closed', `Ticket ${label(t.number)} closed automatically after ${settings.autoCloseDays} days resolved`, { actor: 'system', accountId: t.account_id, data: { ticket: label(t.number) } });
  }
  return due.length;
}

// Owner-only purge of CLOSED tickets (one ticket, or every one closed at least `days` ago). Removes the messages, screenshots and read marks with them.
export async function purge(db, { number = null, days = 0, now = Date.now() }) {
  const rows = number ? await db.all("SELECT id, number FROM support_tickets WHERE number = ? AND status = 'closed'", [Number(number)])
    : await db.all("SELECT id, number FROM support_tickets WHERE status = 'closed' AND COALESCE(closed_at, updated_at) <= ?", [now - days * DAY]);
  let messages = 0, attachments = 0;
  await db.tx(async (x) => {
    for (const t of rows) {
      messages += Number((await x.get('SELECT COUNT(*) AS n FROM support_messages WHERE ticket_id = ?', [t.id])).n); attachments += Number((await x.get('SELECT COUNT(*) AS n FROM support_attachments WHERE ticket_id = ?', [t.id])).n);
      for (const tbl of ['support_messages', 'support_attachments', 'support_views']) await x.run(`DELETE FROM ${tbl} WHERE ticket_id = ?`, [t.id]);
      await x.run('DELETE FROM support_tickets WHERE id = ?', [t.id]);
    }
  });
  return { tickets: rows.length, messages, attachments, numbers: rows.slice(0, 50).map(t => label(t.number)) };
}
export async function closedCount(db, days, now = Date.now()) {
  const r = await db.get("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'closed' AND COALESCE(closed_at, updated_at) <= ?", [now - days * DAY]);
  return Number(r.n);
}
