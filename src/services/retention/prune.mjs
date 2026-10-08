// SERVICES / retention / prune — what each retention rule would remove (preview) and the removal itself. Preview and prune share one selection, so the
// numbers shown before the typed confirmation are the numbers deleted. Only Host-side data is touched: activity-log rows, audit rows, closed support
// tickets, sent/failed mail history and temporary files. The audit entries about retention itself (retention.*) are never selected.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../core/config.mjs';
import { auditScope } from '../audit/types.mjs';
import { purge as purgeTickets } from '../support/tickets.mjs';
import { coded, cleanCutoffDays, DAY } from './rules.mjs';

const SIZE = 'COALESCE(LENGTH(e.raw),0) + COALESCE(LENGTH(e.message),0) + 120';
const CHUNK = 1000;
const tick = () => new Promise(r => setImmediate(r));

// ---- activity log and audit trail (both live in event_log) ----
function logWhere(kind, cutoff) {
  const scope = auditScope();
  if (kind === 'logs') return { sql: `e.ts < ? AND NOT ${scope.sql}`, params: [cutoff, ...scope.params] };       // everything that is not the audit trail
  return { sql: `e.ts < ? AND ${scope.sql} AND e.event NOT LIKE 'retention.%'`, params: [cutoff, ...scope.params] }; // the audit trail, never the retention entries
}
async function logPreview(db, kind, cutoff) {
  const w = logWhere(kind, cutoff), r = await db.get(`SELECT COUNT(*) AS n, MIN(e.ts) AS oldest, COALESCE(SUM(${SIZE}),0) AS bytes FROM event_log e WHERE ${w.sql}`, w.params);
  return { count: Number(r.n), bytes: Number(r.bytes), oldest: r.oldest == null ? null : Number(r.oldest) };
}
async function logRun(db, kind, cutoff) {
  const w = logWhere(kind, cutoff); let count = 0, bytes = 0;
  for (;;) {
    const rows = await db.all(`SELECT e.id, ${SIZE} AS sz FROM event_log e WHERE ${w.sql} ORDER BY e.ts LIMIT ${CHUNK}`, w.params); if (!rows.length) break;
    await db.run(`DELETE FROM event_log WHERE id IN (${rows.map(() => '?').join(',')})`, rows.map(x => x.id));
    count += rows.length; bytes += rows.reduce((a, x) => a + Number(x.sz), 0); await tick();
  }
  return { count, bytes };
}

// ---- closed support tickets ----
const closedWhere = "status = 'closed' AND COALESCE(closed_at, updated_at) <= ?";
async function ticketPreview(db, cutoff) {
  const t = await db.get(`SELECT COUNT(*) AS n, MIN(COALESCE(closed_at, updated_at)) AS oldest FROM support_tickets WHERE ${closedWhere}`, [cutoff]);
  const ids = `SELECT id FROM support_tickets WHERE ${closedWhere}`;
  const m = await db.get(`SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(body)),0) AS bytes FROM support_messages WHERE ticket_id IN (${ids})`, [cutoff]);
  const a = await db.get(`SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS bytes FROM support_attachments WHERE ticket_id IN (${ids})`, [cutoff]);
  return { count: Number(t.n), bytes: Number(m.bytes) + Number(a.bytes), oldest: t.oldest == null ? null : Number(t.oldest), detail: `${Number(m.n)} messages, ${Number(a.n)} screenshots` };
}

// ---- mail history (sent and failed only; queued mail is never touched) ----
const mailWhere = "status IN ('sent','failed') AND COALESCE(sent_at, created_at) < ?";
async function mailPreview(db, cutoff) {
  const r = await db.get(`SELECT COUNT(*) AS n, MIN(COALESCE(sent_at, created_at)) AS oldest, COALESCE(SUM(COALESCE(LENGTH(body_text),0)+COALESCE(LENGTH(body_html),0)+COALESCE(LENGTH(subject),0)+100),0) AS bytes FROM mail_queue WHERE ${mailWhere}`, [cutoff]);
  return { count: Number(r.n), bytes: Number(r.bytes), oldest: r.oldest == null ? null : Number(r.oldest) };
}

// ---- temporary files: scratch folders left by tests of backup files, holding uploads, half-made backup copies ----
const TMP_NAME = /^mbs-/;
const dirSize = (p) => { let n = 0; try { const st = fs.lstatSync(p); if (!st.isDirectory()) return st.size; for (const f of fs.readdirSync(p)) n += dirSize(path.join(p, f)); } catch {} return n; };
export function tempCandidates(cutoff) {
  const out = [], add = (p) => { try { const st = fs.lstatSync(p); if (st.mtimeMs < cutoff) out.push({ path: p, size: dirSize(p), mtime: st.mtimeMs }); } catch {} };
  const scan = (dir, test) => { try { for (const f of fs.readdirSync(dir)) if (test(f)) add(path.join(dir, f)); } catch {} };
  scan(os.tmpdir(), (f) => TMP_NAME.test(f));
  scan(path.join(config.dataDir, 'backup-incoming'), () => true);
  for (const d of new Set([path.join(config.dataDir, 'backup'), path.join(config.dataDir, 'backups')])) scan(d, (f) => /-bundle-temp-|-offsite-temp-/.test(f));
  return out;
}
const tempPreview = (cutoff) => { const c = tempCandidates(cutoff); return { count: c.length, bytes: c.reduce((a, x) => a + x.size, 0), oldest: c.length ? Math.min(...c.map(x => x.mtime)) : null }; };
function tempRun(cutoff) {
  let count = 0, bytes = 0;
  for (const c of tempCandidates(cutoff)) { try { fs.rmSync(c.path, { recursive: true, force: true }); count++; bytes += c.size; } catch {} }
  return { count, bytes };
}

export const UNIT = { logs: 'activity-log rows', audit: 'audit-trail rows', tickets: 'closed tickets', mail: 'mail records', temp: 'temporary files or folders' };

// What a prune of `kind` would remove for rows older than `days`.
export async function preview(db, kind, days, now = Date.now()) {
  const cutoff = now - days * DAY; let p;
  if (kind === 'logs' || kind === 'audit') p = await logPreview(db, kind, cutoff);
  else if (kind === 'tickets') p = await ticketPreview(db, cutoff);
  else if (kind === 'mail') p = await mailPreview(db, cutoff);
  else if (kind === 'temp') p = tempPreview(cutoff);
  else throw coded('RETENTION_KIND');
  return { kind, days, cutoff, unit: UNIT[kind], ...p };
}
// Removes them. Returns { count, bytes, ... } like the preview.
export async function run(db, kind, days, now = Date.now()) {
  const cutoff = now - days * DAY;
  if (kind === 'logs' || kind === 'audit') return { kind, days, unit: UNIT[kind], ...(await logRun(db, kind, cutoff)) };
  if (kind === 'tickets') { const p = await ticketPreview(db, cutoff), out = await purgeTickets(db, { days, now }); return { kind, days, unit: UNIT[kind], count: out.tickets, bytes: p.bytes, detail: `${out.messages} messages, ${out.attachments} screenshots` }; }
  if (kind === 'mail') { const p = await mailPreview(db, cutoff), r = await db.run(`DELETE FROM mail_queue WHERE ${mailWhere}`, [cutoff]); return { kind, days, unit: UNIT[kind], count: r.changes, bytes: p.bytes }; }
  if (kind === 'temp') return { kind, days, unit: UNIT[kind], ...tempRun(cutoff) };
  throw coded('RETENTION_KIND');
}
export { cleanCutoffDays };
