// SERVICES / retention / rules — how long each kind of Host-side data is kept, and the nightly pruning switches. One saved record in the settings table.
// Only data the Host can read is covered (logs, the audit trail, support tickets, mail history, temporary files). Customer business data is encrypted
// and out of reach, so it has no rule here and is never pruned. Backups keep their own rules on the Backups page.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';
import { MSG } from '../../core/messages.mjs';

export const KEY = 'retention';
export const KINDS = ['logs', 'audit', 'tickets', 'mail', 'temp'];
export const AUDIT_FLOOR_DAYS = 365;     // the audit trail is never kept for less than a year
export const DAY = 86400000;
export const DEFAULTS = {
  audit: { days: 0 },                    // 0 = kept forever
  tickets: { days: 0 },                  // 0 = no automatic age: closed tickets stay until the Owner purges them
  mail: { days: 30 },                    // sent and failed messages
  temp: { days: 1 },                     // scratch folders and holding files
  auto: { enabled: true, hour: 3, kinds: { logs: true, audit: false, tickets: false, mail: true, temp: true } },
};
export const coded = (code, extra = {}) => Object.assign(new Error(extra.error || MSG[code] || code), { code, ...extra });

const whole = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '') ? Number(v) : NaN;
// Per-kind check of a days value. Returns the clean number or throws a coded error. 0 means "no automatic age" where that is allowed.
export function cleanDays(kind, raw) {
  const n = whole(raw);
  if (!Number.isInteger(n)) throw coded('RETENTION_BAD', { error: 'Enter a whole number of days.' });
  if (kind === 'logs') { if (n < 7 || n > 730) throw coded('RETENTION_BAD', { error: 'Keep the activity log for a whole number of days from 7 to 730.' }); return n; }
  if (kind === 'audit') {
    if (n === 0) return 0;
    if (n < AUDIT_FLOOR_DAYS) throw coded('RETENTION_AUDIT_FLOOR');
    if (n > 36500) throw coded('RETENTION_BAD', { error: 'Enter 0 for forever, or a number of days from 365 to 36500.' }); return n;
  }
  if (kind === 'tickets') { if (n < 0 || n > 3650) throw coded('RETENTION_BAD', { error: 'Enter 0 for no automatic age, or from 1 to 3650 days.' }); return n; }
  if (kind === 'mail') { if (n < 1 || n > 3650) throw coded('RETENTION_BAD', { error: 'Keep sent and failed mail for a whole number of days from 1 to 3650.' }); return n; }
  if (kind === 'temp') { if (n < 1 || n > 365) throw coded('RETENTION_BAD', { error: 'Keep temporary files for a whole number of days from 1 to 365.' }); return n; }
  throw coded('RETENTION_KIND');
}
// A prune-now override: same checks, but "forever" and "off" (0) are not a cut-off, and the audit floor still holds.
export function cleanCutoffDays(kind, raw) {
  const n = cleanDays(kind, raw);
  if (n === 0) throw coded('RETENTION_BAD', { error: kind === 'audit' ? 'Enter the age in days, 365 or more.' : 'Enter the age in days, 1 or more.' });
  return n;
}
export async function getRules(db) {
  const s = (await getSetting(db, KEY, {})) || {};
  return {
    logs: { days: config.log.retentionDays },   // the activity-log age lives in the server options (runtime service), shown here
    audit: { days: Number.isInteger(s.audit?.days) && (s.audit.days === 0 || s.audit.days >= AUDIT_FLOOR_DAYS) ? s.audit.days : DEFAULTS.audit.days },
    tickets: { days: Number.isInteger(s.tickets?.days) && s.tickets.days >= 0 ? s.tickets.days : DEFAULTS.tickets.days },
    mail: { days: Number.isInteger(s.mail?.days) && s.mail.days >= 1 ? s.mail.days : DEFAULTS.mail.days },
    temp: { days: Number.isInteger(s.temp?.days) && s.temp.days >= 1 ? s.temp.days : DEFAULTS.temp.days },
    auto: {
      enabled: s.auto?.enabled ?? DEFAULTS.auto.enabled,
      hour: Number.isInteger(s.auto?.hour) && s.auto.hour >= 0 && s.auto.hour <= 23 ? s.auto.hour : DEFAULTS.auto.hour,
      kinds: Object.fromEntries(KINDS.map(k => [k, s.auto?.kinds?.[k] ?? DEFAULTS.auto.kinds[k]])),
    },
    saved: { audit: s.audit?.days != null, tickets: s.tickets?.days != null, mail: s.mail?.days != null, temp: s.temp?.days != null, auto: !!s.auto },
  };
}
// Writes one part of the record (the logs age is saved through the server options, not here).
export async function saveRulePart(db, part, value) {
  const s = { ...((await getSetting(db, KEY, {})) || {}) };
  s[part] = value; await setSetting(db, KEY, s);
}
export const getState = (db) => getSetting(db, 'retention_state', {});
export const setState = (db, v) => setSetting(db, 'retention_state', v);
export const fmtBytes = (n) => { n = Number(n) || 0; if (n < 1024) return `${n} B`; const u = ['KB', 'MB', 'GB', 'TB']; let i = -1; do { n /= 1024; i++; } while (n >= 1024 && i < 3); return `${n >= 100 ? Math.round(n) : Math.round(n * 10) / 10} ${u[i]}`; };
