// SERVICES / runtime — server options the Host administrator can change in the Host Console (Settings) instead of container environment
// variables. A saved value wins; if nothing is saved the environment value (or the built-in default) is used. Applied at start and on save.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';

const ENV = { trustProxy: config.trustProxy, secureCookies: config.secureCookies, logLevel: config.log.level, logRetentionDays: config.log.retentionDays };
const LEVELS = ['debug', 'info', 'warn', 'error'], PROXY = ['', '1', '2', '3'];

// Each option: how to check it, and how to apply it to the running server.
const SPEC = {
  trustProxy: { check: (v) => PROXY.includes(String(v)) ? null : 'Choose Off, or 1, 2 or 3 proxies.', norm: (v) => String(v), apply: (v, app) => app?.set('trust proxy', /^\d+$/.test(v) ? Number(v) : (v || false)), set: (v) => { config.trustProxy = v; } },
  secureCookies: { check: (v) => typeof v === 'boolean' ? null : 'Choose on or off.', norm: Boolean, set: (v) => { config.secureCookies = v; } },
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
