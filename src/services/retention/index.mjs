// SERVICES / retention — the Host "Data and retention" service: rules, previews, pruning (by hand or nightly), compaction and the audit entries for all of it.
// Every rule change and every prune writes an audit entry (who or System, what, rows and bytes). Those entries (events retention.*) are never pruned.
import { log } from '../../logging/logger.mjs';
import { KINDS, getRules, getState, setState, DAY, coded, cleanCutoffDays, fmtBytes } from './rules.mjs';
import { preview, run, UNIT } from './prune.mjs';

export * from './rules.mjs';
export { preview, run, UNIT } from './prune.mjs';
export { spaceUsage } from './space.mjs';
export { startCompact, checkCompact } from './compact.mjs';

export const LABEL = { logs: 'activity log', audit: 'audit trail', tickets: 'closed support tickets', mail: 'mail history', temp: 'temporary files' };
const n = (v) => Number(v).toLocaleString('en-US');

// The age a prune of this kind uses: the caller's own number, else the rule. Throws when there is neither (forever / off).
export async function effectiveDays(db, kind, override) {
  if (override != null && override !== '') return cleanCutoffDays(kind, override);
  const rules = await getRules(db), d = rules[kind]?.days;
  if (!d) throw coded('RETENTION_BAD', { error: kind === 'audit' ? 'The audit trail is kept forever. Enter an age in days (365 or more) to prune older entries.' : 'There is no automatic age for this kind of data. Enter an age in days.' });
  return d;
}
// Preview, then (separately) a confirmed prune. `actor` is a Host administrator's name, or 'System' for the nightly run.
export async function pruneAndAudit(db, kind, days, { actor, ip = null, auto = false } = {}) {
  const out = await run(db, kind, days);
  if (auto && !out.count) return out;   // a quiet night leaves no entry
  const when = out.count ? '' : ' (nothing was that old)';
  log('host', 'warn', 'retention.pruned', `${auto ? 'Automatic prune' : 'Pruned'}: removed ${n(out.count)} ${UNIT[kind]} (about ${fmtBytes(out.bytes)}) older than ${days} days from the ${LABEL[kind]}${when}`,
    { actor, ip, data: { kind, rows: out.count, bytes: out.bytes, days, auto, ...(out.detail ? { detail: out.detail } : {}) } });
  return out;
}
export function auditRuleChange(kind, text, { actor, ip, data = {} }) {
  log('host', 'warn', kind === 'auto' ? 'retention.auto' : 'retention.rule', text, { actor, ip, data: { kind, ...data } });
}

// ---- the nightly run ----
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
// Runs the kinds switched on for automatic pruning, once a day, at or after the chosen hour (server time). Kinds with no age (forever / off) are skipped.
export async function runNightly(db, now = Date.now(), { force = false } = {}) {
  const rules = await getRules(db), st = await getState(db);
  if (!force) { if (!rules.auto.enabled) return null; if (new Date(now).getHours() < rules.auto.hour || st.lastRun === dayKey(now)) return null; }
  await setState(db, { ...st, lastRun: dayKey(now), lastRunAt: now });
  const done = [];
  for (const kind of KINDS) {
    if (!rules.auto.kinds[kind]) continue;
    const days = rules[kind].days; if (!days) continue;
    try { const r = await pruneAndAudit(db, kind, days, { actor: 'System', auto: true }); done.push({ kind, count: r.count, bytes: r.bytes }); }
    catch (e) { log('host', 'error', 'retention.refused', `Automatic prune of the ${LABEL[kind]} failed: ${e.message}`, { actor: 'System', data: { kind, auto: true } }); }
  }
  await setState(db, { ...(await getState(db)), lastResult: done });
  return done;
}
let timer = null;
export function startRetentionWorker(db) {
  const tickNow = () => runNightly(db).catch(() => {});
  const every = Number(process.env.RETENTION_TICK_MS) || 15 * 60e3;   // a test can shorten the check
  setTimeout(tickNow, Math.min(30e3, every)).unref(); timer = setInterval(tickNow, every); timer.unref();
}
export const stopRetentionWorker = () => clearInterval(timer);
export { DAY };
