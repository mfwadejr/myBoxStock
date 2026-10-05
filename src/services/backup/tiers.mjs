// SERVICES / backup / tiers — the settings for the frequent snapshots, offsite copies and safety copies, with validation.
// Full-site backups keep their own settings (auto.mjs). Every number has a sane default and a plain-English error when out of range.
import fs from 'node:fs';
import path from 'node:path';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { DEFAULT_THIN, thinPolicy } from './thin.mjs';
import { setBackupDir } from './files.mjs';
import { getPassphrase } from './passphrase.mjs';
import { enabledDestinations } from './destinations/index.mjs';

const L = areaLogger('backup');
export const DEFAULT_TIERS = {
  localDir: '',
  frequent: { enabled: true, everyMinutes: 15, thin: { ...DEFAULT_THIN } },
  offsite: { enabled: false, everyMinutes: 60, destinations: [], thin: { ...DEFAULT_THIN } },
  safety: { keepDays: 30, keepMin: 5 },
};
const whole = (v, lo, hi, what) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`Enter a whole number from ${lo} to ${hi} for ${what}.`); return n; };

export async function getTiers(db) {
  const s = await getSetting(db, 'backup_tiers', {});
  return {
    localDir: s.localDir || '',
    frequent: { ...DEFAULT_TIERS.frequent, ...(s.frequent || {}), thin: thinPolicy({ ...DEFAULT_THIN, ...(s.frequent?.thin || {}) }, { strict: false }) },
    offsite: { ...DEFAULT_TIERS.offsite, ...(s.offsite || {}), destinations: s.offsite?.destinations || [], thin: thinPolicy({ ...DEFAULT_THIN, ...(s.offsite?.thin || {}) }, { strict: false }) },
    safety: { ...DEFAULT_TIERS.safety, ...(s.safety || {}) },
  };
}
export async function applyLocalDir(db) { setBackupDir((await getTiers(db)).localDir); }

// Merges the changes in `p` over the saved settings; throws a plain-English message for anything out of range.
export async function saveTiers(db, p, actor) {
  const cur = await getTiers(db), next = JSON.parse(JSON.stringify(cur));
  if (p.localDir !== undefined) {
    const d = String(p.localDir || '').trim();
    if (d && !path.isAbsolute(d)) throw new Error('The backup folder must be a full path, for example /data/backup.');
    if (d) { try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); } catch { throw new Error(`This server cannot write to ${d}. Choose a folder it can use.`); } }
    next.localDir = d;
  }
  if (p.frequent) {
    const f = p.frequent; if (f.enabled !== undefined) next.frequent.enabled = !!f.enabled;
    if (f.everyMinutes !== undefined) next.frequent.everyMinutes = whole(f.everyMinutes, 5, 1440, 'how often to take a snapshot (minutes)');
    if (f.thin) next.frequent.thin = thinPolicy({ ...cur.frequent.thin, ...f.thin });
  }
  if (p.offsite) {
    const o = p.offsite; if (o.enabled !== undefined) next.offsite.enabled = !!o.enabled;
    if (o.everyMinutes !== undefined) next.offsite.everyMinutes = whole(o.everyMinutes, 15, 1440, 'how often to send an offsite copy (minutes)');
    if (o.thin) next.offsite.thin = thinPolicy({ ...cur.offsite.thin, ...o.thin });
    if (o.destinations !== undefined) next.offsite.destinations = [...new Set((Array.isArray(o.destinations) ? o.destinations : []).map(String).filter(x => x !== 'local'))];
    if (next.offsite.enabled) {
      if (!next.offsite.destinations.length) throw new Error('Choose at least one destination for the offsite copies.');
      if ((await enabledDestinations(db, next.offsite.destinations)).length !== next.offsite.destinations.length) throw new Error('One of the chosen destinations is turned off or no longer exists.');
      if (!(await getPassphrase(db))) throw new Error('Set the backup passphrase (Full-site backups tab) before turning on offsite copies. They are encrypted with it.');
    }
  }
  if (p.safety) {
    if (p.safety.keepDays !== undefined) next.safety.keepDays = whole(p.safety.keepDays, 1, 3650, 'how many days to keep safety copies');
    if (p.safety.keepMin !== undefined) next.safety.keepMin = whole(p.safety.keepMin, 1, 100, 'how many newest safety copies to always keep');
  }
  await setSetting(db, 'backup_tiers', next); setBackupDir(next.localDir);
  L.info('tiers.saved', `Backup settings saved: snapshots ${next.frequent.enabled ? `every ${next.frequent.everyMinutes} min` : 'off'}, offsite ${next.offsite.enabled ? `every ${next.offsite.everyMinutes} min to ${next.offsite.destinations.length} destination(s)` : 'off'}, safety copies kept ${next.safety.keepDays} days (at least ${next.safety.keepMin})`, { actor, data: { frequent: next.frequent, offsite: { ...next.offsite }, safety: next.safety, localDir: next.localDir } });
  return next;
}
