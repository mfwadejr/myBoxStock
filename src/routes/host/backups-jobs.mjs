// ROUTES / host / backups-jobs — long Host jobs run in the background, one at a time: start one, poll the running job, fetch the result, dismiss it.
import express from 'express';
import { fail } from '../../core/messages.mjs';
import * as bk from '../../services/backup/index.mjs';

export function jobsRoutes(db) {
  const r = express.Router();
  // The running job, or the last one that finished (until dismissed), without its result.
  r.get('/current', (req, res) => res.json({ job: bk.publicJob(bk.currentJob()), busy: bk.backupBusy() }));
  r.post('/', (req, res) => {
    const b = req.body || {}, make = bk.JOB_KINDS[String(b.kind || '')];
    if (!make) return fail(res, 400, 'HOST_JOB_KIND');
    if (bk.backupBusy()) return fail(res, 409, 'HOST_JOB_RUNNING', { by: bk.backupBusy() }); // refused first, before anything else is looked at
    try {
      const spec = make(db, b, { actor: req.subject.username, ip: req.ip });
      const job = bk.startJob({ kind: b.kind, label: spec.label, actor: req.subject.username, ip: req.ip, run: spec.run });
      res.status(202).json({ job: bk.publicJob(job) });
    } catch (e) {
      if (e.code === 'HOST_JOB_RUNNING') return fail(res, 409, 'HOST_JOB_RUNNING', { by: e.by });
      if (e?.code) return fail(res, 400, e.code);
      res.status(404).json({ error: e.message === 'Not found' ? 'That backup was not found.' : e.message });
    }
  });
  const find = (req, res) => { const j = bk.getJob(req.params.id); if (!j) fail(res, 404, 'HOST_JOB_GONE'); return j; };
  r.get('/:id', (req, res) => { const j = find(req, res); if (j) res.json({ job: bk.publicJob(j, { result: true }) }); });
  r.post('/:id/detach', (req, res) => { const j = find(req, res); if (j) { bk.detachJob(j.id); res.json({ ok: true }); } });
  // Stops a job that can stop (Demo mode's Build, Remove and Reset): it ends after the step it is on. Written to the audit trail.
  r.post('/:id/stop', (req, res) => {
    const j = find(req, res); if (!j) return;
    const ok = bk.stopJob(j.id); if (ok) bk.audit('demo.stopped', `Stop requested for the background job: ${j.label}`, { actor: req.subject.username, ip: req.ip, level: 'warn', data: { kind: j.kind, job: j.id } });
    res.json({ ok });
  });
  r.post('/:id/dismiss', (req, res) => { const j = find(req, res); if (j) res.json({ ok: bk.dismissJob(j.id) }); });
  return r;
}
