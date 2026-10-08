// ROUTES / host / retention — the "Data and retention" page: space used, one retention rule per kind of Host-side data, preview and confirmed prune,
// compaction (a background job) and the nightly pruning switches. Everyone signed in to the Host Console may read; only the Owner administrator changes,
// prunes or compacts. Every change and every prune is written to the audit trail. Customer business data is encrypted and never touched here.
import express from 'express';
import { fail, MSG } from '../../core/messages.mjs';
import { hostLog } from './context.mjs';
import { config } from '../../core/config.mjs';
import { saveRuntime } from '../../services/runtime/index.mjs';
import { getTiers } from '../../services/backup/tiers.mjs';
import { backupBusy, publicJob, currentJob } from '../../services/backup/index.mjs';
import * as rt from '../../services/retention/index.mjs';

export function retentionRoutes(db) {
  const r = express.Router();
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res, next); } catch (e) { if (e?.code && MSG[e.code]) return fail(res, e.status || (e.code === 'HOST_JOB_RUNNING' ? 409 : 400), e.code, { ...(e.error ? { error: e.error } : {}), ...(e.by ? { by: e.by } : {}), ...(e.need ? { need: e.need, free: e.free } : {}) }); next(e); } };
  const ownerId = async () => (await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1'))?.id;
  const owner = async (req, res, what) => {
    if (req.subject.id === await ownerId()) return true;
    hostLog(req, 'warn', 'retention.refused', `${what} was refused: only the Owner administrator may change retention`, { data: { refused: true } });
    fail(res, 403, 'RETENTION_OWNER_ONLY'); return false;
  };
  const kindOf = (v) => { if (!rt.KINDS.includes(String(v))) throw rt.coded('RETENTION_KIND'); return String(v); };

  r.get('/', wrap(async (req, res) => {
    const rules = await rt.getRules(db), tiers = await getTiers(db), state = await rt.getState(db);
    res.json({
      isOwner: req.subject.id === await ownerId(), rules, space: await rt.spaceUsage(db), state: { lastRunAt: state.lastRunAt || null, lastResult: state.lastResult || [] },
      auditFloorDays: rt.AUDIT_FLOOR_DAYS, logFiles: { maxMb: config.log.maxFileMb, keep: config.log.keepFiles },
      backups: { frequentThin: tiers.frequent.thin, safety: tiers.safety, offsite: tiers.offsite.enabled }, sqlite: db.client === 'sqlite',
      job: publicJob(currentJob()), busy: backupBusy(),
    });
  }));

  r.put('/rules/:kind', wrap(async (req, res) => {
    const kind = kindOf(req.params.kind);
    if (!await owner(req, res, `A change to the ${rt.LABEL[kind]} rule`)) return;
    let days; try { days = rt.cleanDays(kind, req.body?.days); } catch (e) { hostLog(req, 'warn', 'retention.refused', `A change to the ${rt.LABEL[kind]} rule was refused: ${e.message}`, { data: { kind, days: req.body?.days, refused: true } }); throw e; }
    const before = (await rt.getRules(db))[kind].days;
    if (kind === 'logs') { const bad = await saveRuntime(db, req.app, { logRetentionDays: days }, { secure: req.secure }); if (bad) return fail(res, 400, 'RETENTION_BAD', { error: bad }); }
    else await rt.saveRulePart(db, kind, { days });
    const word = (d) => !d ? (kind === 'audit' ? 'forever' : 'off') : `${d} days`;
    rt.auditRuleChange('rule', `Retention rule for the ${rt.LABEL[kind]} changed from ${word(before)} to ${word(days)}`, { actor: req.subject.username, ip: req.ip, data: { before, after: days } });
    res.json({ ok: true, rules: await rt.getRules(db) });
  }));

  r.put('/auto', wrap(async (req, res) => {
    if (!await owner(req, res, 'A change to automatic pruning')) return;
    const b = req.body || {}, cur = (await rt.getRules(db)).auto, next = { enabled: cur.enabled, hour: cur.hour, kinds: { ...cur.kinds } };
    if (b.enabled !== undefined) next.enabled = !!b.enabled;
    if (b.hour !== undefined) { const h = Number(b.hour); if (!Number.isInteger(h) || h < 0 || h > 23) return fail(res, 400, 'RETENTION_BAD', { error: 'Choose an hour from 0 to 23.' }); next.hour = h; }
    for (const [k, v] of Object.entries(b.kinds || {})) { if (!rt.KINDS.includes(k)) return fail(res, 400, 'RETENTION_KIND'); next.kinds[k] = !!v; }
    await rt.saveRulePart(db, 'auto', next);
    const diff = [...(next.enabled !== cur.enabled ? [`nightly pruning ${next.enabled ? 'on' : 'off'}`] : []), ...(next.hour !== cur.hour ? [`hour ${next.hour}:00`] : []), ...rt.KINDS.filter(k => next.kinds[k] !== cur.kinds[k]).map(k => `${rt.LABEL[k]} ${next.kinds[k] ? 'automatic' : 'manual'}`)];
    rt.auditRuleChange('auto', `Automatic pruning changed: ${diff.join(', ') || 'saved with no change'}`, { actor: req.subject.username, ip: req.ip, data: { before: cur, after: next } });
    res.json({ ok: true, rules: await rt.getRules(db) });
  }));

  // What a prune would remove. Read-only, so every administrator may look.
  r.get('/preview', wrap(async (req, res) => {
    const kind = kindOf(req.query.kind), days = await rt.effectiveDays(db, kind, req.query.days);
    res.json(await rt.preview(db, kind, days));
  }));
  r.post('/prune', wrap(async (req, res) => {
    const kind = kindOf(req.body?.kind);
    if (!await owner(req, res, `A prune of the ${rt.LABEL[kind]}`)) return;
    if (req.body?.confirm !== 'PRUNE') return fail(res, 400, 'RETENTION_CONFIRM');
    const days = await rt.effectiveDays(db, kind, req.body?.days), out = await rt.pruneAndAudit(db, kind, days, { actor: req.subject.username, ip: req.ip });
    res.json({ ok: true, ...out });
  }));

  r.post('/compact', wrap(async (req, res) => {
    if (!await owner(req, res, 'Compacting the database')) return;
    const job = await rt.startCompact(db, { actor: req.subject.username, ip: req.ip, audit: (d) => hostLog(req, 'warn', 'retention.compacted', `Database compacted: freed about ${rt.fmtBytes(d.freed)} (${rt.fmtBytes(d.before)} to ${rt.fmtBytes(d.after)})`, { data: d }) });
    res.status(202).json({ job: publicJob(job) });
  }));
  return r;
}
