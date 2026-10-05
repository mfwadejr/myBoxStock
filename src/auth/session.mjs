// AUTH / session — cookie sessions for two separate realms: 'host' (platform admin) and 'app' (accounts).
// Different cookie names and subject tables: a session from one realm is never valid in the other.
import { config } from '../core/config.mjs';
import { token, sha256 } from '../core/ids.mjs';
import { areaLogger } from '../logging/logger.mjs';
import { normalizeIp } from '../security/firewall/ip.mjs';
import { fullPath } from '../core/http.mjs';
import { fail } from '../core/messages.mjs';

const L = areaLogger('auth');
const COOKIE = { host: 'mbs_host', app: 'mbs_app' };
const TTL = { host: 8 * 3600e3, app: 14 * 24 * 3600e3 };
const PENDING_TTL = 10 * 60e3;

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
function setCookie(res, name, value, maxAgeMs) {
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (config.secureCookies) flags.push('Secure');
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; ${flags.join('; ')}`);
}

// Signing in again from the same browser and address replaces the older sign-in instead of piling up one per visit.
async function dropDuplicates(db, realm, subjectId, keepHash) {
  const me = await db.get('SELECT ip, ua FROM sessions WHERE token_hash = ?', [keepHash]); if (!me) return;
  await db.run('DELETE FROM sessions WHERE realm = ? AND subject_id = ? AND ip = ? AND ua = ? AND token_hash <> ? AND mfa_pending = 0', [realm, subjectId, me.ip, me.ua, keepHash]);
}
export async function createSession(db, res, req, { realm, subjectId, accountId = null, pending = false }) {
  const raw = token(32), csrf = token(18), now = Date.now(), ttl = pending ? PENDING_TTL : TTL[realm];
  await db.run(`INSERT INTO sessions (token_hash, realm, subject_id, account_id, mfa_ok, mfa_pending, csrf, ip, ua, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [sha256(raw), realm, subjectId, accountId, pending ? 0 : 1, pending ? 1 : 0, csrf, normalizeIp(req.ip).slice(0, 64), String(req.headers['user-agent'] || '').slice(0, 200), now, now + ttl]);
  if (!pending) await dropDuplicates(db, realm, subjectId, sha256(raw));
  setCookie(res, COOKIE[realm], raw, ttl);
  L.info('session.created', `${realm} session created${pending ? ' (waiting for two-factor code)' : ''}`, { ip: normalizeIp(req.ip), accountId, data: { realm, subjectId, pending } });
  return csrf;
}
export async function promoteSession(db, req, res, realm) {
  const raw = parseCookies(req)[COOKIE[realm]]; if (!raw) return;
  await db.run('UPDATE sessions SET mfa_pending = 0, mfa_ok = 1, expires_at = ? WHERE token_hash = ?', [Date.now() + TTL[realm], sha256(raw)]);
  const s = await db.get('SELECT subject_id FROM sessions WHERE token_hash = ?', [sha256(raw)]); if (s) await dropDuplicates(db, realm, s.subject_id, sha256(raw));
  setCookie(res, COOKIE[realm], raw, TTL[realm]);
}
export async function destroySession(db, req, res, realm) {
  const raw = parseCookies(req)[COOKIE[realm]];
  if (raw) await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(raw)]);
  setCookie(res, COOKIE[realm], '', 0);
}
export async function destroyAllFor(db, realm, subjectId, reason = '') {
  const r = await db.run('DELETE FROM sessions WHERE realm = ? AND subject_id = ?', [realm, subjectId]);
  if (r.changes) L.info('session.revoked', `Revoked ${r.changes} ${realm} session(s)${reason ? ` — ${reason}` : ''}`, { data: { realm, subjectId, count: r.changes, reason } });
}
export async function readSession(db, req, realm) {
  const raw = parseCookies(req)[COOKIE[realm]]; if (!raw) return null;
  const s = await db.get('SELECT * FROM sessions WHERE token_hash = ? AND realm = ?', [sha256(raw), realm]);
  return s && s.expires_at >= Date.now() ? s : null;
}

// Express middleware. loadSubject(db, session) returns the user row or null.
export function requireSession(db, realm, loadSubject, { allowPending = false, allowMustChange = false } = {}) {
  return async (req, res, next) => {
    try {
      const ip = normalizeIp(req.ip);
      const s = await readSession(db, req, realm);
      if (!s || (s.mfa_pending && !allowPending)) { L.info('access.unauthenticated', `No valid ${realm} session for ${req.method} ${fullPath(req)}`, { ip, data: { realm, path: fullPath(req), mfaPending: !!s?.mfa_pending } }); return fail(res, 401, 'NOT_SIGNED_IN'); }
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-csrf-token') !== s.csrf) {
        L.warn('csrf.rejected', `Missing or wrong CSRF token on ${req.method} ${fullPath(req)}`, { ip, accountId: s.account_id, data: { realm, path: fullPath(req), subjectId: s.subject_id } });
        return fail(res, 403, 'CSRF_BAD');
      }
      const subject = await loadSubject(db, s);
      if (!subject) { L.warn('access.subject_missing', `Session ${realm}/${s.subject_id} points at a missing, disabled or suspended user`, { ip, accountId: s.account_id }); return fail(res, 401, 'NOT_SIGNED_IN'); }
      if (subject.must_change && !allowMustChange) return fail(res, 403, 'PASSWORD_CHANGE_REQUIRED', { mustChange: true });
      req.session = s; req.subject = subject; next();
    } catch (e) { next(e); }
  };
}
export async function purgeExpired(db) {
  const a = await db.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
  const b = await db.run('DELETE FROM password_resets WHERE expires_at < ?', [Date.now()]);
  if (a.changes || b.changes) L.debug('purge', `Purged ${a.changes} expired sessions and ${b.changes} expired reset links`);
}
