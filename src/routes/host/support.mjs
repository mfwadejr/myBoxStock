// ROUTES / host / support — the Host side of support tickets: the list, a ticket with its requester panel, replies and internal notes, statuses,
// the Support settings, a Host note on each reseller, and the Owner-only purge. Every action is written to the audit trail (events support.*).
// PRIVACY BOUNDARY: only what the reseller wrote in the ticket, plus identity and plan facts about the account. Never inventory, customers or sales.
import express from 'express';
import { hostLog } from './context.mjs';
import { fail } from '../../core/messages.mjs';
import { config } from '../../core/config.mjs';
import { billingState } from '../../services/billing/state.mjs';
import { enqueueMail, processQueue, mailReady } from '../../services/mail/index.mjs';
import { siteUrl } from '../../services/site/index.mjs';
import * as sup from '../../services/support/index.mjs';

const PAGE = 100, MAIL_OFF = 'Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway.';

export function supportRoutes(db) {
  const r = express.Router();
  const log = (req, event, msg, t, data = {}) => hostLog(req, 'info', event, msg, { accountId: t?.account_id || null, data: { ...(t ? { ticket: sup.label(t.number) } : {}), ...data } });
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res, next); } catch (e) { if (e?.code) return fail(res, e.status || 400, e.code, e.extra); next(e); } };
  const ownerId = async () => (await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1'))?.id;
  const ticketOf = async (req, res) => { const t = await db.get('SELECT * FROM support_tickets WHERE number = ?', [Number(req.params.no) || 0]); if (!t) fail(res, 404, 'NOT_FOUND'); return t; };
  const staff = () => db.all('SELECT id, username FROM host_admins ORDER BY username');

  r.get('/summary', wrap(async (req, res) => res.json(await sup.summary(db, await sup.getSupportSettings(db)))));
  r.get('/staff', wrap(async (req, res) => res.json(await staff())));

  // ---- settings ----
  r.get('/settings', wrap(async (req, res) => {
    const s = await sup.getSupportSettings(db);
    res.json({ settings: s, mailReady: await mailReady(db), mailNote: MAIL_OFF, isOwner: req.subject.id === await ownerId(), closed: await sup.closedCount(db, 0), limits: { maxFilesMax: 5, maxKBMax: 2048 } });
  }));
  r.put('/settings', wrap(async (req, res) => {
    const c = await sup.cleanSupportSettings(db, req.body || {}); if (c.error) return fail(res, 400, 'SUPPORT_SETTINGS_BAD', { error: c.error });
    await sup.saveSupportSettings(db, c.value);
    const changed = Object.keys(c.value).filter(k => JSON.stringify(c.value[k]) !== JSON.stringify(c.cur[k]));
    log(req, 'support.settings', changed.length ? `Support settings changed: ${changed.join(', ')}` : 'Support settings saved with no change', null, { keys: changed, before: Object.fromEntries(changed.filter(k => k !== 'canned').map(k => [k, c.cur[k]])), after: Object.fromEntries(changed.filter(k => k !== 'canned').map(k => [k, c.value[k]])), cannedCount: c.value.canned.length });
    res.json({ ok: true, settings: c.value });
  }));

  // ---- the list ----
  r.get('/tickets', wrap(async (req, res) => {
    const s = await sup.getSupportSettings(db), q = req.query, where = [], args = [];
    const st = String(q.status || 'active');
    if (st === 'active') { where.push(`t.status IN (${sup.ACTIVE.map(() => '?').join(',')})`); args.push(...sup.ACTIVE); }
    else if (st === 'overdue') { where.push(`t.status IN (${sup.AWAITING_HOST.map(() => '?').join(',')})`); args.push(...sup.AWAITING_HOST); }
    else if (sup.STATUSES.includes(st)) { where.push('t.status = ?'); args.push(st); }
    if (q.priority) { where.push('t.priority = ?'); args.push(String(q.priority)); }
    if (q.category) { where.push('t.category = ?'); args.push(String(q.category)); }
    if (q.assignee === 'none') where.push('t.assignee_id IS NULL'); else if (q.assignee) { where.push('t.assignee_id = ?'); args.push(String(q.assignee)); }
    if (q.account) { where.push('t.account_id = ?'); args.push(String(q.account)); }
    const text = String(q.q || '').trim().toLowerCase().replace(/[%_\\]/g, '');
    if (text) {
      const like = `%${text}%`, no = text.replace(/^t-?/, '');
      where.push(`(LOWER(t.subject) LIKE ? OR LOWER(t.account_name) LIKE ? OR LOWER(t.account_code) LIKE ? OR LOWER(t.requester_username) LIKE ? OR LOWER(t.requester_email) LIKE ? ${/^\d+$/.test(no) ? 'OR t.number = ?' : ''} OR EXISTS (SELECT 1 FROM support_messages m WHERE m.ticket_id = t.id AND LOWER(m.body) LIKE ?))`);
      args.push(like, like, like, like, like, ...(/^\d+$/.test(no) ? [Number(no)] : []), like);
    }
    const sql = `FROM support_tickets t LEFT JOIN host_admins h ON h.id = t.assignee_id${where.length ? ' WHERE ' + where.join(' AND ') : ''}`;
    let rows = (await db.all(`SELECT t.*, h.username AS assignee_name ${sql} ORDER BY t.updated_at DESC, t.number DESC LIMIT 1000`, args)).map(t => sup.shape(t, s));
    if (st === 'overdue') rows = rows.filter(t => t.overdue);
    const offset = Math.max(0, Number(q.offset) || 0);
    res.json({ tickets: rows.slice(offset, offset + PAGE), total: rows.length, responseDays: s.responseDays });
  }));

  // ---- one ticket ----
  r.get('/tickets/:no', wrap(async (req, res) => {
    const t = await ticketOf(req, res); if (!t) return;
    const s = await sup.getSupportSettings(db), now = Date.now();
    const acc = t.account_id ? await db.get('SELECT id, account_code, business_name, status, plan, trial_ends_at, plan_until, created_at, last_activity FROM accounts WHERE id = ?', [t.account_id]) : null;
    const person = t.requester_id ? await db.get('SELECT username, role, email, disabled FROM account_users WHERE id = ?', [t.requester_id]) : null;
    const others = await db.all('SELECT number, subject, status, created_at FROM support_tickets WHERE account_id = ? AND id <> ? ORDER BY created_at DESC LIMIT 25', [t.account_id || '-', t.id]);
    const b = acc ? billingState(acc) : null, note = t.account_id ? await db.get('SELECT body, updated_at, updated_by FROM support_notes WHERE account_id = ?', [t.account_id]) : null;
    log(req, 'support.viewed', `Opened support ticket ${sup.label(t.number)}`, t);
    res.json({
      ticket: { ...sup.shape({ ...t, assignee_name: t.assignee_id ? (await db.get('SELECT username FROM host_admins WHERE id = ?', [t.assignee_id]))?.username : null }, s, now), source: t.source }, now,
      messages: await sup.thread(db, t.id, { forHost: true }),
      requester: {
        account: { id: acc?.id || null, gone: !acc, name: acc?.business_name || t.account_name, code: acc?.account_code || t.account_code, status: acc?.status || 'erased', plan: b ? b.state : null, canWrite: b ? b.canWrite : null, daysLeft: b?.daysLeft ?? null, createdAt: acc ? Number(acc.created_at) : null, lastActivity: acc?.last_activity ? Number(acc.last_activity) : null },
        person: { username: person?.username || t.requester_username, role: person?.role || t.requester_role, email: person?.email || t.requester_email || null, removed: !person },
        appVersion: t.app_version, currentVersion: config.version, device: t.device, others: others.map(o => ({ number: Number(o.number), label: sup.label(o.number), subject: o.subject, status: o.status, statusLabel: sup.STATUS_LABEL[o.status], createdAt: Number(o.created_at) })),
        hostNote: note ? { body: note.body, updatedAt: Number(note.updated_at), updatedBy: note.updated_by } : null,
      },
      options: { statuses: sup.STATUSES.map(v => [v, sup.STATUS_LABEL[v]]), priorities: s.priorities, categories: s.categories, canned: s.canned, staff: await staff(), maxFiles: s.maxFiles, maxKB: s.maxKB, mailReady: await mailReady(db), mailNote: MAIL_OFF },
    });
  }));

  r.post('/tickets/:no/reply', wrap(async (req, res) => {
    const t = await ticketOf(req, res); if (!t) return;
    const b = req.body || {}, s = await sup.getSupportSettings(db), out = await sup.hostReply(db, t, req.subject, s, { message: b.message, internal: !!b.internal, status: b.status, attachmentIds: b.attachmentIds });
    if (out.internal) { log(req, 'support.note', `Internal note added to ${sup.label(t.number)}`, t, { files: (b.attachmentIds || []).length }); return res.json({ ok: true, internal: true }); }
    log(req, 'support.reply', `Replied to ${sup.label(t.number)}, status now ${sup.STATUS_LABEL[out.status]}${out.claimed ? ' (took the ticket)' : ''}`, t, { status: out.status, claimed: out.claimed, files: (b.attachmentIds || []).length });
    if (out.status !== t.status) log(req, 'support.status', `${sup.label(t.number)} status ${sup.STATUS_LABEL[t.status]} -> ${sup.STATUS_LABEL[out.status]}`, t, { from: t.status, to: out.status });
    if (out.claimed) log(req, 'support.assign', `${sup.label(t.number)} assigned to ${req.subject.username} (by replying)`, t, { to: req.subject.username, auto: true });
    // Tell the reseller by email only when Email is set up and they have an address; the in-app badge is always there.
    const email = await notify(t);
    res.json({ ok: true, internal: false, status: out.status, email });
  }));
  async function notify(t) {
    if (!await mailReady(db)) return { sent: false, why: MAIL_OFF };
    const to = (t.requester_id && (await db.get('SELECT email FROM account_users WHERE id = ?', [t.requester_id]))?.email) || t.requester_email;
    if (!to) return { sent: false, why: 'The person who opened this ticket has no email address, so they will see the reply in the app only.' };
    try { await enqueueMail(db, to, 'support_reply', { name: t.requester_username, ticketNo: sup.label(t.number), ticketSubject: t.subject, url: `${await siteUrl(db)}/app/#/support/${t.number}` }); processQueue(db).catch(() => {}); return { sent: true }; }
    catch (e) { return { sent: false, why: String(e.message).slice(0, 200) }; }
  }

  r.patch('/tickets/:no', wrap(async (req, res) => {
    const t = await ticketOf(req, res); if (!t) return;
    const s = await sup.getSupportSettings(db), b = req.body || {}, done = [];
    for (const f of ['status', 'priority', 'category', 'assignee']) {
      if (b[f] === undefined) continue;
      const c = await sup.change(db, t, req.subject, f, f === 'assignee' ? (b[f] || null) : String(b[f]), s);
      if (!c.changed) continue; done.push(f);
      const ev = f === 'assignee' ? 'support.assign' : `support.${f}`;
      log(req, ev, f === 'assignee' ? `${sup.label(t.number)} assigned to ${c.shown}` : `${sup.label(t.number)} ${f} changed from ${c.from} to ${f === 'status' ? sup.STATUS_LABEL[b[f]] : b[f]}`, t, { from: c.from, to: c.shown });
    }
    res.json({ ok: true, changed: done });
  }));

  r.get('/attachments/:id', wrap(async (req, res) => {
    const a = await db.get('SELECT id, name, mime, ticket_id FROM support_attachments WHERE id = ? AND ticket_id IS NOT NULL', [req.params.id]); if (!a) return fail(res, 404, 'NOT_FOUND');
    await sup.sendAttachment(db, res, a);
  }));
  r.post('/upload', wrap(async (req, res) => {
    const s = await sup.getSupportSettings(db);
    try {
      const bytes = await sup.readBytes(req, s.maxKB * 1024 + 16), f = await sup.savePending(db, { owner: { kind: 'host', id: req.subject.id }, name: String(req.query.name || ''), bytes, settings: s });
      hostLog(req, 'info', 'support.screenshot_added', `A screenshot (${f.mime}, ${f.size} bytes) was added to a support message`, { data: { size: f.size } });
      res.json(f);
    } catch (e) { if (e.code) res.set('Connection', 'close'); throw e; }
  }));
  r.delete('/upload/:id', wrap(async (req, res) => { await sup.dropPending(db, { kind: 'host', id: req.subject.id }, req.params.id); res.json({ ok: true }); }));

  // ---- per reseller: their tickets, and the Host's own free-form notes ----
  r.get('/accounts/:id', wrap(async (req, res) => {
    const s = await sup.getSupportSettings(db), rows = await db.all('SELECT t.*, h.username AS assignee_name FROM support_tickets t LEFT JOIN host_admins h ON h.id = t.assignee_id WHERE t.account_id = ? ORDER BY t.created_at DESC LIMIT 200', [req.params.id]);
    const note = await db.get('SELECT body, updated_at, updated_by FROM support_notes WHERE account_id = ?', [req.params.id]);
    res.json({ tickets: rows.map(t => sup.shape(t, s)), note: note ? { body: note.body, updatedAt: Number(note.updated_at), updatedBy: note.updated_by } : null });
  }));
  r.put('/accounts/:id/notes', wrap(async (req, res) => {
    const a = await db.get('SELECT id, account_code FROM accounts WHERE id = ?', [req.params.id]); if (!a) return fail(res, 404, 'NOT_FOUND');
    const body = String(req.body?.body ?? '').replace(/\r\n?/g, '\n').trim(); if (body.length > 4000) return fail(res, 400, 'SUPPORT_NOTE_BAD');
    const had = await db.get('SELECT body FROM support_notes WHERE account_id = ?', [a.id]);
    await db.tx(async (x) => { await x.run('DELETE FROM support_notes WHERE account_id = ?', [a.id]); if (body) await x.run('INSERT INTO support_notes (account_id, body, updated_at, updated_by) VALUES (?,?,?,?)', [a.id, body, Date.now(), req.subject.username]); });
    hostLog(req, 'info', 'support.account_note', `Host note for ${a.account_code} ${body ? (had ? 'edited' : 'added') : 'cleared'}`, { accountId: a.id, data: { code: a.account_code, length: body.length } });
    res.json({ ok: true });
  }));

  // ---- retention: closed tickets stay until the Owner purges them ----
  r.get('/purge-preview', wrap(async (req, res) => { const d = Number(req.query.days); if (!Number.isInteger(d) || d < 0 || d > 3650) return fail(res, 400, 'SUPPORT_PURGE_BAD'); res.json({ count: await sup.closedCount(db, d) }); }));
  r.post('/purge', wrap(async (req, res) => {
    if (req.subject.id !== await ownerId()) { hostLog(req, 'warn', 'support.purge', 'A purge of closed tickets was refused: only the Owner administrator may purge', { data: { refused: true } }); return fail(res, 403, 'SUPPORT_OWNER_ONLY'); }
    const b = req.body || {}; if (b.confirm !== 'PURGE') return fail(res, 400, 'SUPPORT_PURGE_CONFIRM');
    const one = b.number ? Number(b.number) : null, days = Number(b.days ?? 0); if (!one && (!Number.isInteger(days) || days < 0 || days > 3650)) return fail(res, 400, 'SUPPORT_PURGE_BAD');
    if (one) { const t = await db.get('SELECT status FROM support_tickets WHERE number = ?', [one]); if (!t) return fail(res, 404, 'NOT_FOUND'); if (t.status !== 'closed') return fail(res, 409, 'SUPPORT_PURGE_BAD', { error: 'Only closed tickets can be purged. Close the ticket first.' }); }
    const out = await sup.purge(db, { number: one, days });
    hostLog(req, 'warn', 'support.purge', `Purged ${out.tickets} closed ticket${out.tickets === 1 ? '' : 's'} (${out.messages} messages, ${out.attachments} screenshots)${one ? `: ${sup.label(one)}` : `, closed at least ${days} days ago`}`, { data: { ...out, days: one ? null : days, ticket: one ? sup.label(one) : null } });
    res.json({ ok: true, ...out });
  }));
  return r;
}
