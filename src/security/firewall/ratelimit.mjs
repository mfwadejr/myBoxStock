// SECURITY / firewall / ratelimit — sliding-window counters, violation tracking, temporary bans.
import { areaLogger } from '../../logging/logger.mjs';
import { getLimits } from './config.mjs';

const L = areaLogger('security');
const hits = new Map();        // key -> number[] timestamps
const violations = new Map();  // ip -> count
const bans = new Map();        // ip -> expires ms
const stats = { blocked: 0, limited: 0 };
const quiet = new Map();       // log-throttle: key -> { until, suppressed }

export const firewallStats = () => ({ ...stats, activeBans: listBans().length });
export const countBlocked = () => { stats.blocked++; };
export const countLimited = () => { stats.limited++; };

// Log at most once per 30 s per key, reporting how many repeats were suppressed (prevents log floods during an attack).
export function logThrottled(key, level, event, message, extra) {
  const q = quiet.get(key), now = Date.now();
  if (q && q.until > now) { q.suppressed++; return; }
  L[level](event, q?.suppressed ? `${message} (+${q.suppressed} similar since last entry)` : message, extra);
  quiet.set(key, { until: now + 30000, suppressed: 0 });
}

export function overLimit(key, windowMs, max) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}
export function recordViolation(ip, why) {
  const lim = getLimits(), n = (violations.get(ip) || 0) + 1;
  violations.set(ip, n);
  if (n >= lim.banAfterViolations) {
    bans.set(ip, Date.now() + lim.banMinutes * 60000); violations.delete(ip);
    L.warn('ban.created', `Temporarily banned ${ip} for ${lim.banMinutes} min after ${n} violations (${why})`, { ip, data: { minutes: lim.banMinutes, violations: n, why } });
  }
}
export const banUntil = (ip) => { const e = bans.get(ip); return e && e > Date.now() ? e : 0; };
export const listBans = () => { const now = Date.now(); return [...bans].filter(([, e]) => e > now).map(([ip, expires]) => ({ ip, expires })); };
export function unban(ip, actor) { bans.delete(ip); violations.delete(ip); L.info('ban.lifted', `Lifted ban on ${ip}`, { actor, ip, data: { ip } }); }

setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) { const f = arr.filter(t => now - t < 86400000); f.length ? hits.set(k, f) : hits.delete(k); }
  for (const [ip, e] of bans) if (e < now) { bans.delete(ip); L.info('ban.expired', `Ban on ${ip} expired`, { ip }); }
}, 60000).unref();
