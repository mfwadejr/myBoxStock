// AUTH / lockout — per-identity failed-attempt counter (separate from the per-IP firewall limiter).
import { areaLogger } from '../logging/logger.mjs';
import { saveBlock, deleteBlock, COUNTER_TTL } from '../security/blocks.mjs';

const L = areaLogger('auth');
const MAX_FAILS = 6, LOCK_MS = 15 * 60e3;
const fails = new Map(); // key -> { n, until }

export const isLocked = (key) => { const f = fails.get(key); return !!f && f.until > Date.now(); };
export function clearFailures(key) { if (fails.delete(key)) { deleteBlock('lockout', key); deleteBlock('failures', key); } }
// At start: put back what was saved (active lockouts and the counters leading to one), so a restart does not let an attacker back in.
export const restoreLockouts = { lockout: ({ subject, expires }) => { const f = fails.get(subject) || { n: 0, until: 0 }; f.until = expires; fails.set(subject, f); },
  failures: ({ subject, hits }) => { const f = fails.get(subject) || { n: 0, until: 0 }; f.n = hits; fails.set(subject, f); } };
export function registerFailure(key, { ip, realm, accountId = null } = {}) {
  const f = fails.get(key) || { n: 0, until: 0 };
  f.n++;
  if (f.n >= MAX_FAILS) {
    f.until = Date.now() + LOCK_MS; f.n = 0;
    L.warn('lockout.started', `Locked "${key}" for 15 minutes after ${MAX_FAILS} failed attempts`, { actor: key, ip, accountId, data: { key, realm, minutes: 15 } });
    saveBlock('lockout', key, { reason: realm, expires: f.until }); deleteBlock('failures', key);
  } else saveBlock('failures', key, { hits: f.n, reason: realm, expires: Date.now() + COUNTER_TTL });
  fails.set(key, f);
  return f;
}
