// AUTH / lockout — per-identity failed-attempt counter (separate from the per-IP firewall limiter).
import { areaLogger } from '../logging/logger.mjs';

const L = areaLogger('auth');
const MAX_FAILS = 6, LOCK_MS = 15 * 60e3;
const fails = new Map(); // key -> { n, until }

export const isLocked = (key) => { const f = fails.get(key); return !!f && f.until > Date.now(); };
export const clearFailures = (key) => fails.delete(key);
export function registerFailure(key, { ip, realm, accountId = null } = {}) {
  const f = fails.get(key) || { n: 0, until: 0 };
  f.n++;
  if (f.n >= MAX_FAILS) {
    f.until = Date.now() + LOCK_MS; f.n = 0;
    L.warn('lockout.started', `Locked "${key}" for 15 minutes after ${MAX_FAILS} failed attempts`, { ip, accountId, data: { key, realm, minutes: 15 } });
  }
  fails.set(key, f);
  return f;
}
