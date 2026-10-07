// AUTH / lockout — per-identity failed-attempt counter (separate from the per-IP firewall limiter).
import { areaLogger } from '../logging/logger.mjs';
import { saveBlock, deleteBlock, COUNTER_TTL } from '../security/blocks.mjs';

const L = areaLogger('auth'), LS = areaLogger('security');
const MAX_FAILS = 6, LOCK_MS = 15 * 60e3;
const fails = new Map(); // key -> { n, until }

export const isLocked = (key) => { const f = fails.get(key); return !!f && f.until > Date.now(); };
export function clearFailures(key) { if (fails.delete(key)) { deleteBlock('lockout', key); deleteBlock('failures', key); } }
// At start: put back what was saved (active lockouts and the counters leading to one), so a restart does not let an attacker back in.
export const restoreLockouts = { lockout: ({ subject, expires, reason }) => { const f = fails.get(subject) || { n: 0, until: 0 }; f.until = expires; f.realm = reason || ''; fails.set(subject, f); },
  failures: ({ subject, hits }) => { const f = fails.get(subject) || { n: 0, until: 0 }; f.n = hits; fails.set(subject, f); } };
export function registerFailure(key, { ip, realm, accountId = null } = {}) {
  const f = fails.get(key) || { n: 0, until: 0 };
  f.n++;
  if (f.n >= MAX_FAILS) {
    f.until = Date.now() + LOCK_MS; f.n = 0; f.realm = realm || '';
    L.warn('lockout.started', `Locked "${key}" for 15 minutes after ${MAX_FAILS} failed attempts`, { actor: key, ip, accountId, data: { key, realm, minutes: 15 } });
    saveBlock('lockout', key, { reason: realm, expires: f.until }); deleteBlock('failures', key);
  } else saveBlock('failures', key, { hits: f.n, reason: realm, expires: Date.now() + COUNTER_TTL });
  fails.set(key, f);
  return f;
}

// Active lockouts, for the Host Console (Firewall page). A key is a sign-in name, or "mfa:<user id>" for too many wrong two-factor codes.
export const listLockouts = () => [...fails].filter(([, f]) => f.until > Date.now()).map(([key, f]) => ({ key, realm: f.realm || '', expires: f.until }));
// A Host administrator lets a locked-out person try again: clears the lockout and the failure counter (saved copies too). Never touches a password.
// Returns false when there was nothing to clear. `accountId` ties the audit entry to an account when the unlock is done from its detail.
export function unlock(key, { actor, ip, accountId = null, reason = '' } = {}) {
  const f = fails.get(key); if (!f || (f.until <= Date.now() && !f.n)) return false;
  const wasLocked = f.until > Date.now();
  clearFailures(key);
  LS.warn('lockout.lifted', `${wasLocked ? 'Unlocked' : 'Cleared the failed attempts for'} "${key}"${reason ? `: ${reason}` : ''}`, { actor, ip, accountId, data: { key, wasLocked, reason } });
  return true;
}
