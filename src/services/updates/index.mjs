// SERVICES / updates — which version is running, what the last update did, and (optionally) whether a newer release exists.
// The server never updates itself: a new version is installed by rebuilding the container. This only reports.
import { config } from '../../core/config.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { raise, resolve } from '../alerts/index.mjs';

const L = areaLogger('system');
const KEY = 'run_history', CHECK = 'update_check';
const started = Date.now();

// Called once at start-up (after migrations). Remembers the version, and notes when it changed.
export async function recordStartup(db) {
  const h = await getSetting(db, KEY, {}), now = Date.now();
  const migrations = (await db.all('SELECT id, applied_at FROM schema_migrations WHERE applied_at >= ? ORDER BY id', [now - 120e3])).map(m => Number(m.id));
  const next = { ...h, version: config.version, build: config.build || '', startedAt: now };
  if (h.version && h.version !== config.version) {
    next.lastUpdate = { from: h.version, to: config.version, at: now, migrations, clean: true };
    L.info('update.applied', `Updated from ${h.version} to ${config.version}${migrations.length ? ` (database migrations ${migrations.join(', ')} applied)` : ''}`, { data: next.lastUpdate });
  }
  await setSetting(db, KEY, next);
}
const semver = (v) => String(v || '').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
export const isNewer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

export async function getCheck(db) { return { url: '', latest: '', checkedAt: null, error: '', notes: '', ...(await getSetting(db, CHECK, {})) }; }
export async function saveCheckUrl(db, url) {
  url = String(url || '').trim();
  if (url && (!/^https:\/\/[^\s]+$/.test(url) || url.length > 300)) throw new Error('Enter a full https:// address, or leave it empty to stop checking.');
  const c = await getCheck(db); await setSetting(db, CHECK, { ...c, url, latest: url === c.url ? c.latest : '', checkedAt: url === c.url ? c.checkedAt : null, error: '' });
  if (!url) await resolve(db, 'update.available');
}
// Reads the release feed (the GitHub "latest release" address returns JSON with tag_name). One short request; the answer is only a version label.
export async function checkNow(db) {
  const c = await getCheck(db); if (!c.url) throw new Error('Add a release address first.');
  let next = { ...c, checkedAt: Date.now(), error: '' };
  try {
    const res = await fetch(c.url, { headers: { Accept: 'application/json', 'User-Agent': 'myBoxStock' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`The release address answered ${res.status}.`);
    const j = await res.json(), tag = String(j.tag_name || j.version || '').slice(0, 40);
    if (!/^v?\d+\.\d+\.\d+/.test(tag)) throw new Error('The release address did not return a version number.');
    next = { ...next, latest: tag.replace(/^v/i, ''), notes: String(j.html_url || '').slice(0, 300) };
  } catch (e) { next.error = String(e.name === 'TimeoutError' ? 'The release address did not answer in time.' : e.message).slice(0, 200); }
  await setSetting(db, CHECK, next);
  if (!next.error && isNewer(next.latest, config.version)) await raise(db, { kind: 'update.available', level: 'info', title: `Version ${next.latest} is available`, detail: `This server runs ${config.version}. Rebuild the container to update.` });
  else if (!next.error) await resolve(db, 'update.available');
  return next;
}
export async function status(db) {
  const h = await getSetting(db, KEY, {}), c = await getCheck(db);
  const errors = Number((await db.get("SELECT COUNT(*) AS n FROM event_log WHERE area = 'error' AND ts >= ?", [h.startedAt || started])).n);
  return { version: config.version, build: config.build || '', startedAt: h.startedAt || started, lastUpdate: h.lastUpdate || null, errorsSinceStart: errors,
    check: { ...c, configured: !!c.url, newer: !!c.latest && isNewer(c.latest, config.version) } };
}
let timer;
export function startUpdateWorker(db) { timer = setInterval(async () => { try { if ((await getCheck(db)).url) await checkNow(db); } catch {} }, 24 * 3600e3); timer.unref(); }
