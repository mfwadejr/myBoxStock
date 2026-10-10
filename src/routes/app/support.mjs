// ROUTES / app / support — a signed-in reseller opens and follows internal support tickets. Everyone in the account may open one;
// Standard and View users see only their own, Administrators see all of the account's. Tickets are readable by the Host (the form says so).
import express from 'express';
import { can, tenantLog } from './context.mjs';
import { fail } from '../../core/messages.mjs';
import { buildDiagnostics } from '../../services/backup/diagnostics.mjs';
import * as sup from '../../services/support/index.mjs';
import { ticketNotice } from '../../services/support/notify.mjs';

export function supportRoutes(db) {
  const r = express.Router();
  const isAdmin = (req) => can(req.subject.perms, 'users.manage'), owner = (req) => ({ kind: 'user', id: req.subject.id });
  const send = (res, e) => e?.code ? fail(res, e.status || 400, e.code, e.extra) : null;
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res, next); } catch (e) { if (!send(res, e)) next(e); } };
  const diag = (req, on) => on ? buildDiagnostics(db, req.subject, req.get('user-agent')) : null;

  r.get('/config', wrap(async (req, res) => res.json({ ...sup.formConfig(await sup.getSupportSettings(db)), isAdmin: isAdmin(req) })));
  r.get('/unread', wrap(async (req, res) => res.json({ n: await sup.unreadCount(db, req.subject, isAdmin(req)) })));
  r.get('/diagnostics', wrap(async (req, res) => res.json({ text: await buildDiagnostics(db, req.subject, req.get('user-agent')) })));
  r.get('/tickets', wrap(async (req, res) => res.json({ tickets: await sup.listForUser(db, req.subject, isAdmin(req)).then(rows => rows.map(publicRow(req))), isAdmin: isAdmin(req) })));

  r.post('/tickets', wrap(async (req, res) => {
    const b = req.body || {}, s = await sup.getSupportSettings(db);
    try {
      const t = await sup.openTicket(db, req.subject, s, { category: b.category, subject: b.subject, message: b.message, attachmentIds: b.attachmentIds, diagnostics: await diag(req, !!b.diagnostics) }, req.get('user-agent'));
      tenantLog(req, 'support.ticket_opened', `${req.subject.login} opened support ticket ${t.label} (${b.category}${b.diagnostics ? ', diagnostics attached' : ''})`, { ticket: t.label, category: b.category, diagnostics: !!b.diagnostics, files: (b.attachmentIds || []).length });
      await ticketNotice(db, t.number, 'new');   // alert and email to the Host; never fails the request
      res.json({ ok: true, ticket: t });
    } catch (e) { if (e.code) tenantLog(req, 'support.ticket_refused', `${req.subject.login} could not open a support ticket: ${e.code}`, { code: e.code }); throw e; }
  }));

  const mine = async (req, res) => { const t = await sup.findForUser(db, req.subject, isAdmin(req), req.params.no); if (!t) fail(res, 404, 'NOT_FOUND'); return t; };
  r.get('/tickets/:no', wrap(async (req, res) => {
    const t = await mine(req, res); if (!t) return;
    await sup.markSeen(db, t.id, req.subject.id);
    const messages = (await sup.thread(db, t.id, { forHost: false })).map(m => ({ id: m.id, ts: m.ts, who: m.side === 'system' ? 'system' : m.side === 'host' ? 'team' : m.authorId === req.subject.id ? 'you' : 'colleague', author: m.side === 'requester' ? m.author : m.author, body: m.body, diagnostics: m.diagnostics, attachments: m.attachments }));
    res.json({ ticket: publicRow(req)(sup.shape(t)), messages, canReply: t.status !== 'closed' });
  }));
  r.post('/tickets/:no/messages', wrap(async (req, res) => {
    const t = await mine(req, res); if (!t) return;
    const b = req.body || {}, out = await sup.requesterReply(db, t, req.subject, await sup.getSupportSettings(db), { message: b.message, attachmentIds: b.attachmentIds, diagnostics: await diag(req, !!b.diagnostics) });
    tenantLog(req, 'support.reply', `${req.subject.login} replied to support ticket ${sup.label(t.number)}${out.reopened ? ' (reopened it)' : ''}`, { ticket: sup.label(t.number), reopened: out.reopened });
    await ticketNotice(db, t.number, 'reply');
    res.json({ ok: true, ...out });
  }));
  r.get('/attachments/:id', wrap(async (req, res) => {
    const a = await db.get('SELECT a.id, a.name, a.mime, a.ticket_id, a.message_id, t.account_id, t.requester_id, m.internal FROM support_attachments a JOIN support_tickets t ON t.id = a.ticket_id JOIN support_messages m ON m.id = a.message_id WHERE a.id = ?', [req.params.id]);
    if (!a || a.account_id !== req.subject.account_id || Number(a.internal) || (!isAdmin(req) && a.requester_id !== req.subject.id)) return fail(res, 404, 'NOT_FOUND');
    await sup.sendAttachment(db, res, a);
  }));
  // A screenshot is uploaded on its own (raw bytes), checked, and kept as pending until the ticket or reply that uses it is sent.
  r.post('/upload', wrap(async (req, res) => {
    const s = await sup.getSupportSettings(db);
    try {
      const bytes = await sup.readBytes(req, s.maxKB * 1024 + 16), f = await sup.savePending(db, { owner: owner(req), accountId: req.subject.account_id, name: String(req.query.name || ''), bytes, settings: s });
      tenantLog(req, 'support.screenshot_added', `${req.subject.login} added a screenshot (${f.mime}, ${f.size} bytes) to a support message`, { size: f.size, mime: f.mime });
      res.json(f);
    } catch (e) { if (e.code) res.set('Connection', 'close'); throw e; }
  }));
  r.delete('/upload/:id', wrap(async (req, res) => { await sup.dropPending(db, owner(req), req.params.id); res.json({ ok: true }); }));

  return r;
}

// What a reseller sees of a ticket: no priority, assignee or Host-only wording; the status is phrased from their side.
const MINE = { open: 'Open', waiting_host: 'Waiting on myBoxStock', waiting_reseller: 'Waiting on you', resolved: 'Resolved', closed: 'Closed' };
const publicRow = (req) => (t) => ({ number: t.number, label: t.label, subject: t.subject, category: t.category, status: t.status, statusLabel: MINE[t.status], createdAt: t.createdAt, updatedAt: t.updatedAt, requester: t.requester, own: t.requester === req.subject.username, unread: t.unread ?? false });
