// SERVICES / backup / jobs — long Host jobs (Test restore, restore, full-site backup, Test a backup file) run in the background, one at a time.
// A job takes the one backup lock, runs the existing service code (which reports its step and its bytes through progress.mjs), and keeps its
// outcome in memory: the Backups page polls it, shows the bar and the step, and can fetch the result after the sheet was closed or the page
// reloaded. Starting, finishing and failing are written to the audit trail. The job record never holds a passphrase.
import crypto from 'node:crypto';
import { areaLogger } from '../../logging/logger.mjs';
import { jobContext } from './progress.mjs';
import { takeBackupLock, backupBusy } from './runner.mjs';
import { coded } from './gate.mjs';
import { audit } from './audit.mjs';

const L = areaLogger('backup');
let current = null; // the running job, or the last finished one until it is dismissed or another job starts
const droppers = new Set();
// Callers register what to do with a one-time token that nobody is waiting for (the sheet that would have used it was closed).
export const onDetachedToken = (fn) => droppers.add(fn);
export const RESTART_MS = 600;

// What the page may see about a job. `result` only on request; never the parameters.
export const publicJob = (j, { result = false } = {}) => j && ({
  id: j.id, kind: j.kind, label: j.label, actor: j.actor, status: j.status, step: j.step, pct: Math.round(j.pct), bytesDone: j.bytesDone, bytesTotal: j.bytesTotal,
  startedAt: j.startedAt, finishedAt: j.finishedAt, error: j.error, restarting: j.restarting, ok: j.ok, stoppable: !!j.stoppable, stopRequested: !!j.stopRequested, summary: j.summary, hasResult: j.result != null, ...(result ? { result: j.result } : {}),
});
export const currentJob = () => current;
export const getJob = (id) => (current && current.id === id ? current : null);
// Asks a stoppable job to stop. The job finishes the unit it is on, then ends; nothing is cut off in the middle.
export function stopJob(id) { const j = getJob(id); if (!j || j.status !== 'running' || !j.stoppable) return false; j.stopRequested = true; return true; }
export function dismissJob(id) { if (current && current.id === id && current.status !== 'running') { current = null; return true; } return false; }
export function detachJob(id) { const j = getJob(id); if (j) j.detached = true; return !!j; }
export const resetJobsForTests = () => { current = null; };

// Starts `run` in the background. Throws HOST_JOB_RUNNING when any backup work holds the lock. `run()` returns the result; a thrown error is the failure.
export function startJob({ kind, label, actor, ip = null, run, stoppable = false }) {
  const release = takeBackupLock(label);
  if (!release) throw Object.assign(coded('HOST_JOB_RUNNING'), { by: backupBusy() });
  const now = Date.now(), j = { id: crypto.randomBytes(8).toString('hex'), kind, label, actor, status: 'running', step: 'Starting', pct: 1, bytesDone: null, bytesTotal: null, startedAt: now, finishedAt: null, result: null, error: null, restarting: false, ok: null, summary: '', detached: false, from: 0, to: 100, stoppable, stopRequested: false };
  current = j;
  const ctx = {
    stopRequested: () => j.stopRequested,
    step(text, from, to) { j.step = text; j.from = from ?? j.pct; j.to = to ?? j.to; j.bytesDone = j.bytesTotal = null; j.pct = Math.max(j.pct, j.from); },
    bytes(done, total) { j.bytesDone = done; j.bytesTotal = total; if (total > 0) j.pct = Math.max(j.pct, j.from + (j.to - j.from) * Math.min(1, done / total)); },
  };
  audit('backup.job_started', `Background job started: ${label}`, { actor, ip, data: { kind, job: j.id } });
  jobContext.run(ctx, async () => {
    try {
      const out = await run();
      j.result = out ?? null; j.ok = out && typeof out === 'object' && 'ok' in out ? !!out.ok : true; j.summary = (out && out.summary) || (j.ok ? 'Finished.' : 'Finished with problems.');
      j.restarting = !!(out && out.restarting); j.status = 'done'; j.pct = 100; j.step = j.restarting ? 'Restarting the site' : 'Finished';
      audit('backup.job_finished', `Background job finished: ${label} (${j.ok ? 'ok' : 'did not pass'})`, { actor, ip, level: j.ok ? 'info' : 'warn', data: { kind, job: j.id, ok: j.ok, ms: Date.now() - now } });
      L.info('job.done', `Job ${label} finished in ${Date.now() - now} ms`, { actor, data: { kind, ok: j.ok } });
      if (j.detached && out?.token) { for (const d of droppers) { try { d(out.token); } catch {} } delete out.token; }
      if (j.restarting) setTimeout(() => process.exit(0), RESTART_MS); // the supervisor restarts the app with the restored database
    } catch (e) {
      j.status = 'failed'; j.ok = false; j.error = { message: String(e.message || e).slice(0, 400), code: e.code || null }; j.summary = j.error.message; j.step = 'Failed';
      audit('backup.job_finished', `Background job FAILED: ${label}: ${j.error.message}`, { actor, ip, level: 'error', data: { kind, job: j.id, ok: false, error: j.error.message } });
      L.error('job.failed', `Job ${label} failed: ${j.error.message}`, { actor, data: { kind, error: j.error.message } });
    } finally { j.finishedAt = Date.now(); release(); }
  });
  return j;
}
