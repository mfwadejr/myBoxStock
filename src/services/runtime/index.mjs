// SERVICES / runtime — server options the Host administrator can change in the Host Console (Settings) instead of container environment
// variables. A saved value wins; if nothing is saved the environment value (or the built-in default) is used. Applied at start and on save.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';
import { visitorViaCloudflare } from '../../security/cloudflare.mjs';

const ENV = { trustProxy: config.trustProxy, secureCookies: config.secureCookies, logLevel: config.log.level, logRetentionDays: config.log.retentionDays, allowPrivateMail: config.mailAllowPrivate, cloudflareIp: config.cloudflareIp };
const LEVELS = ['debug', 'info', 'warn', 'error'], PROXY = ['', '1', '2', '3'];

// Each option: how to check it, and how to apply it to the running server.
const SPEC = {
  trustProxy: { check: (v) => PROXY.includes(String(v)) ? null : 'Choose Off, or 1, 2 or 3 proxies.', norm: (v) => String(v), apply: (v, app) => app?.set('trust proxy', /^\d+$/.test(v) ? Number(v) : (v || false)), set: (v) => { config.trustProxy = v; } },
  cloudflareIp: { check: (v) => typeof v === 'boolean' ? null : 'Choose on or off.', norm: Boolean, set: (v) => { config.cloudflareIp = v; } },
  secureCookies: { check: (v) => typeof v === 'boolean' ? null : 'Choose on or off.', norm: Boolean, set: (v) => { config.secureCookies = v; } },
  allowPrivateMail: { check: (v) => typeof v === 'boolean' ? null : 'Choose on or off.', norm: Boolean, set: (v) => { config.mailAllowPrivate = v; } },
  logLevel: { check: (v) => LEVELS.includes(v) ? null : 'Choose debug, info, warn or error.', norm: String, set: (v) => { config.log.level = v; } },
  logRetentionDays: { check: (v) => Number.isInteger(Number(v)) && v >= 7 && v <= 730 ? null : 'Keep the log for a whole number of days from 7 to 730.', norm: Number, set: (v) => { config.log.retentionDays = v; } },
};

const savedOf = async (db) => await getSetting(db, 'runtime', {}) || {};

export async function applyRuntime(db, app) {
  const saved = await savedOf(db);
  for (const [k, spec] of Object.entries(SPEC)) { const v = k in saved ? saved[k] : ENV[k]; spec.set(v); spec.apply?.(v, app); }
}

export async function runtimeStatus(db) {
  const saved = await savedOf(db);
  return Object.fromEntries(Object.keys(SPEC).map(k => [k, { value: k in saved ? saved[k] : ENV[k], saved: k in saved, env: ENV[k] }]));
}

// body: { key: value | null }  (null = go back to the server's environment value). Returns an error message or '' when saved.
export async function saveRuntime(db, app, body, { secure }) {
  const saved = { ...await savedOf(db) }, changed = [];
  for (const [k, v] of Object.entries(body || {})) {
    const spec = SPEC[k]; if (!spec) continue;
    if (v === null) { delete saved[k]; changed.push(k); continue; }
    const bad = spec.check(v); if (bad) return bad;
    if (k === 'secureCookies' && spec.norm(v) && !secure) return 'You are not using https right now, so turning this on would stop you signing in. Open the Host Console through your https address first.';
    saved[k] = spec.norm(v); changed.push(k);
  }
  await setSetting(db, 'runtime', saved); await applyRuntime(db, app);
  return '';
}

// The address this request would be seen as if the proxy count were `value` ('' = none). Used to refuse a change that would lock the
// person making it out of the Host Console, before it is saved.
export function addressWith(req, value, cloudflare = config.cloudflareIp) {
  const v = String(value ?? ''), n = /^\d+$/.test(v) ? Number(v) : 0, hops = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean);
  const chain = [...hops, req.socket?.remoteAddress || ''];   // the last entry is the connection itself; each trusted proxy lets us step one back
  const seen = chain[Math.max(0, chain.length - 1 - n)];
  return (cloudflare && visitorViaCloudflare(req.headers, seen)) || seen;
}
// Forget every saved server option (back to the container's environment). Used by `node server.mjs reset-server-options`.
export async function clearRuntime(db) { await db.run('DELETE FROM settings WHERE k = ?', ['runtime']); }
