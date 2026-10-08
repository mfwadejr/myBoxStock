// LOGGING / logger — the one way anything is logged.
//
//   const L = areaLogger('auth');
//   L.warn('login.failed', 'Failed sign-in for alice@bx-… (wrong password)', { actor, accountId, ip, data: { realm: 'app' } });
//
// Every call writes THREE copies:
//   1. raw JSON line      -> <LOG_DIR>/<area>/<area>.jsonl      (machine readable, full `data`)
//   2. human-readable line -> <LOG_DIR>/<area>/<area>.log        (what an admin reads)
//   3. database row        -> event_log table                     (for the future web viewer; not for `http`)
// Secrets are redacted from `data` automatically. Never pass business data (inventory, customers, sales).
import { config } from '../core/config.mjs';
import { newId } from '../core/ids.mjs';
import path from 'node:path';
import { AREAS, LEVELS, FILE_ONLY_AREAS } from './areas.mjs';
import { RotatingFile } from './rotating-file.mjs';

const REDACT = /(password|passwd|secret|token|csrf|hash|recovery|otp|authorization|cookie)/i;
const files = new Map();     // `${area}.${kind}` -> RotatingFile
let db = null;
let pending = [];            // rows waiting for the database sink
let flushing = false;
let dbWarned = false;

function fileFor(area, kind) {
  const key = `${area}.${kind}`;
  if (!files.has(key)) files.set(key, new RotatingFile(path.join(config.log.dir, area, `${area}.${kind}`), config.log.maxFileMb * 1048576, config.log.keepFiles));
  return files.get(key);
}
export function redact(v, depth = 0) {
  if (v == null || depth > 4) return v;
  if (Array.isArray(v)) return v.map(x => redact(x, depth + 1));
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, REDACT.test(k) ? '[redacted]' : redact(val, depth + 1)]));
  if (typeof v === 'string' && v.length > 500) return v.slice(0, 500) + '…';
  return v;
}
const stamp = (t) => new Date(t).toISOString().replace('T', ' ').replace('Z', '');

export function log(area, level, event, message, { actor = null, accountId = null, ip = null, data = null } = {}) {
  if (!AREAS[area]) { area = 'error'; event = `bad_area.${event}`; }
  if ((LEVELS[level] || 20) < (LEVELS[config.log.level] || 20)) return;
  const t = Date.now();
  const safe = data ? redact(data) : null;
  const raw = { ts: new Date(t).toISOString(), t, level, area, event, message, actor, accountId, ip, data: safe };
  const human = `${stamp(t)}  ${level.toUpperCase().padEnd(5)}  ${event.padEnd(26)} ${message}` +
    `${actor ? `  | actor=${actor}` : ''}${accountId ? `  | account=${accountId}` : ''}${ip ? `  | ip=${ip}` : ''}\n`;
  try { fileFor(area, 'jsonl').write(JSON.stringify(raw) + '\n'); fileFor(area, 'log').write(human); } catch (e) { console.error('log file write failed:', e.message); }
  if (config.log.console && (level !== 'debug')) console.log(`[${area}] ${human.trimEnd()}`);
  if (!FILE_ONLY_AREAS.includes(area)) { pending.push({ id: newId(), t, level, area, event, actor, accountId, ip, message, raw: JSON.stringify(raw) }); scheduleFlush(); }
}

export function areaLogger(area) {
  const mk = (level) => (event, message, extra) => log(area, level, event, message, extra);
  return { debug: mk('debug'), info: mk('info'), warn: mk('warn'), error: mk('error') };
}

// ---- database sink ----
export function attachLogDb(database) { db = database; scheduleFlush(); }
function scheduleFlush() { if (db && !flushing && pending.length) setTimeout(flush, 250).unref(); }
export async function flush() {
  if (!db || flushing) return; flushing = true;
  try {
    while (pending.length) {
      const batch = pending.splice(0, 100);
      for (const r of batch) {
        try {
          await db.run('INSERT INTO event_log (id, ts, level, area, event, actor, account_id, ip, message, raw) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [r.id, r.t, r.level, r.area, r.event, r.actor, r.accountId, r.ip, r.message, r.raw]);
        } catch (e) { if (!dbWarned) { dbWarned = true; console.error('event_log insert failed:', e.message); } }
      }
    }
  } finally { flushing = false; }
}
export async function closeLogs() { await flush(); await Promise.all([...files.values()].map(f => f.close())); }
// Pruning of the database copy lives in services/retention (it keeps the audit trail out of the activity-log trimming).
