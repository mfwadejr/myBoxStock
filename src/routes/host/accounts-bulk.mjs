// ROUTES / host / accounts-bulk — bulk actions on the Accounts page: preview, run (inline or as a background job), poll the job, export.
// Host administrators with the View role can look but not change, so they cannot use any of this. Nothing here suspends, closes or deletes an account.
import express from 'express';
import { fail } from '../../core/messages.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';
import { log } from '../../logging/logger.mjs';
import { newId } from '../../core/ids.mjs';
import { preview, resolveTargets, plan, execute, startBulkJob, currentBulkJob, publicBulkJob, dismissBulkJob, phraseFor, mailReady, EMAIL_CAP, ACTIONS } from '../../services/accounts/bulk.mjs';

// Today every Host administrator can change accounts; a Host administrator whose role is View (when roles exist) cannot.
export const canBulk = (admin) => String(admin?.role || '').toLowerCase() !== 'view';
const CODES = new Set(['BULK_NONE', 'BULK_TOO_MANY', 'BULK_BAD_ACTION', 'BULK_BAD_INPUT', 'BULK_JOB_RUNNING']);

export function bulkRoutes(db) {
  const r = express.Router();
  const refuse = (req, code, why) => log('host', 'warn', 'bulk.refused', `Bulk action refused (${why})`, { actor: req.subject?.username, ip: normalizeIp(req.ip), data: { code, action: req.body?.action } });
  r.use((req, res, next) => { if (canBulk(req.subject)) return next(); refuse(req, 'BULK_NOT_ALLOWED', 'View role'); fail(res, 403, 'BULK_NOT_ALLOWED'); });
  const known = (e, res) => { if (e?.code && CODES.has(e.code)) return fail(res, e.code === 'BULK_JOB_RUNNING' ? 409 : 400, e.code); log('host', 'error', 'bulk.summary', `Bulk action failed: ${e.message}`, { actor: res.req?.subject?.username, data: { failed: true } }); return fail(res, 500, 'BULK_FAILED'); };
  const reasonOf = (b) => String(b?.reason ?? '').trim().slice(0, 200);

  r.post('/preview', async (req, res) => {
    try {
      const out = await preview(db, String(req.body?.action || ''), req.body?.params, req.body?.selection);
      if (req.body?.params?.email && !(await mailReady(db))) out.emailOff = true;
      res.json(out);
    } catch (e) { known(e, res); }
  });

  r.post('/run', async (req, res) => {
    const b = req.body || {}, action = String(b.action || '');
    try {
      if (!ACTIONS.includes(action) || action === 'export') return fail(res, 400, 'BULK_BAD_ACTION');
      const targets = await resolveTargets(db, b.selection), pl = plan(action, b.params, targets);
      if (!pl.applies.length) return fail(res, 400, 'BULK_NOTHING');
      if (reasonOf(b).length < 3) return fail(res, 400, 'BULK_REASON_REQUIRED');
      if (Number(b.expect) !== pl.applies.length) { refuse(req, 'BULK_CHANGED', 'selection changed'); return fail(res, 409, 'BULK_CHANGED'); }
      if (String(b.confirm || '').trim().toUpperCase() !== phraseFor(action, pl.applies.length)) { refuse(req, 'BULK_CONFIRM', 'confirmation not typed'); return fail(res, 400, 'BULK_CONFIRM'); }
      if (pl.params.email) {
        if (!(await mailReady(db))) return fail(res, 400, 'BULK_EMAIL_OFF');
        if (pl.params.mails > EMAIL_CAP) return fail(res, 400, 'BULK_EMAIL_CAP');
      }
      const opts = { actor: req.subject.username, ip: normalizeIp(req.ip), reason: reasonOf(b), runId: newId() };
      if (pl.applies.length >= 25) return res.json({ job: publicBulkJob(startBulkJob(db, action, b.params, targets, opts)) });
      res.json({ result: await execute(db, action, b.params, targets, opts) });
    } catch (e) { known(e, res); }
  });

  // CSV of the Host-visible fields. No typed confirmation (nothing changes); still logged for every account and as a summary.
  r.post('/export', async (req, res) => {
    try {
      const targets = await resolveTargets(db, req.body?.selection);
      const out = await execute(db, 'export', {}, targets, { actor: req.subject.username, ip: normalizeIp(req.ip), reason: reasonOf(req.body) });
      res.json({ filename: `accounts-${new Date().toISOString().slice(0, 10)}.csv`, csv: out.csv, count: out.done });
    } catch (e) { known(e, res); }
  });

  r.get('/job', (req, res) => res.json({ job: publicBulkJob(currentBulkJob()) }));
  r.post('/job/:id/dismiss', (req, res) => res.json({ ok: dismissBulkJob(String(req.params.id)) }));
  return r;
}
