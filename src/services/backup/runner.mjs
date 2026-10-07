// SERVICES / backup / runner — takes the frequent snapshots, sends the offsite copies, trims old copies, and makes sure two backups never overlap.
// A failure is recorded, logged, written to the audit trail and raised as the "backup is failing" alert in the Host Console.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { areaLogger } from '../../logging/logger.mjs';
import { createBackup } from './create.mjs';
import { backupDir, backupPath, deleteBackup, listBackups, takenAtFromName } from './files.mjs';
import { thin } from './thin.mjs';
import { getTiers } from './tiers.mjs';
import { recordTier, getTierStatus } from './status.mjs';
import { checkSqliteFile } from './testrestore.mjs';
import { audit } from './audit.mjs';
import { enabledDestinations, uploadVerified, clientFor } from './destinations/index.mjs';

const L = areaLogger('backup');
let busy = '';
export const backupBusy = () => busy;
// Runs fn unless another backup is running. Returns { skipped: true, by } when busy.
export async function withBackupLock(label, fn) {
  if (busy) { L.info('lock.busy', `Skipped ${label}: ${busy} is still running`); return { skipped: true, by: busy }; }
  busy = label; try { return { skipped: false, value: await fn() }; } finally { busy = ''; }
}

// Takes the one backup lock for a background job; returns the release function, or null when something else holds it.
export function takeBackupLock(label) { if (busy) return null; busy = label; return () => { busy = ''; }; }

export async function raiseFailing(db, title, detail) {
  try { const { raise } = await import('../alerts/index.mjs'); await raise(db, { kind: 'backup.failing', level: 'error', title: 'The scheduled backup is failing', detail: `${title}: ${String(detail).slice(0, 300)}` }); } catch (e) { L.error('alert.failed', `Could not raise the backup alert: ${e.message}`); }
}
async function failed(db, tier, e, actor, trigger) {
  const error = String(e.message || e).slice(0, 400);
  L.error(`${tier}.failed`, `${tier === 'frequent' ? 'Frequent snapshot' : 'Offsite copy'} failed: ${error}`, { actor, data: { tier, trigger, error } });
  audit('backup.run', `${tier === 'frequent' ? 'Snapshot' : 'Offsite copy'} failed (${trigger}): ${error}`, { actor, level: 'error', data: { tier, trigger, ok: false } });
  await recordTier(db, tier, { lastAttemptAt: Date.now(), lastFail: { at: Date.now(), error, trigger } });
  await raiseFailing(db, tier === 'frequent' ? 'Frequent snapshots are failing' : 'Offsite copies are failing', error);
  return { ok: false, error };
}

// One snapshot into the backup folder, checked, then the older ones thinned.
export async function runFrequent(db, { actor = 'scheduler', trigger = 'scheduled' } = {}) {
  try {
    const t0 = Date.now(), name = await createBackup(db, 'snap', actor), file = backupPath(name);
    const verified = name.endsWith('.db') ? checkSqliteFile(file, { quick: true }).checks.every(c => c.ok) : fs.statSync(file).size > 0;
    if (!verified) throw new Error(`The snapshot ${name} did not pass its check.`);
    const tiers = await getTiers(db), removed = pruneFrequent(tiers.frequent.thin);
    const size = fs.statSync(file).size;
    await recordTier(db, 'frequent', { lastAttemptAt: Date.now(), lastOk: { at: Date.now(), name, size, verified, trigger } });
    L.info('frequent.ok', `Snapshot ${name} done (${(size / 1024).toFixed(0)} KB, ${Date.now() - t0} ms${removed ? `, ${removed} old one${removed === 1 ? '' : 's'} thinned out` : ''})`, { actor, data: { name, size, removed, trigger } });
    audit('backup.run', `Snapshot ${name} taken (${trigger})`, { actor, data: { tier: 'frequent', name, size, trigger, ok: true } });
    return { ok: true, name, size, verified };
  } catch (e) { return failed(db, 'frequent', e, actor, trigger); }
}
export function pruneFrequent(policy, now = Date.now()) {
  const items = listBackups().filter(b => b.label === 'snap' && !b.legacy).map(b => ({ name: b.name, t: b.takenAt }));
  const { drop } = thin(items, policy, now);
  for (const d of drop) deleteBackup(d.name, 'scheduler');
  return drop.length;
}

// Remote sets: copies named myboxstock-offsite-<stamp>… thinned the same way.
export async function pruneRemote(client, prefix, policy, now = Date.now()) {
  const files = (await client.list()).filter(f => f.name.startsWith(prefix)).map(f => ({ name: f.name, t: takenAtFromName(f.name, f.mtime) }));
  const { drop } = thin(files, policy, now); for (const d of drop) await client.remove(d.name);
  return drop.length;
}
export async function pruneRemoteCount(client, tag, keep) {
  const files = (await client.list()).filter(f => f.name.startsWith(`myboxstock-fullsite-${tag}-`)).sort((a, b) => takenAtFromName(b.name, b.mtime) - takenAtFromName(a.name, a.mtime));
  for (const f of files.slice(keep)) await client.remove(f.name); return Math.max(0, files.length - keep);
}

// One fresh snapshot, encrypted and sent to every chosen destination; each upload is checked before the next step.
export async function runOffsite(db, { actor = 'scheduler', trigger = 'scheduled' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-offsite-')); let snap = null;
  try {
    const tiers = await getTiers(db), dests = await enabledDestinations(db, tiers.offsite.destinations);
    if (!dests.length) throw new Error('No destination is turned on for offsite copies.');
    const name = await createBackup(db, 'offsite-temp', actor); snap = backupPath(name);
    const ext = path.extname(name), stampPart = name.replace(/^myboxstock-offsite-temp-/, '').replace(/\.\w+$/, ''), remoteName = `myboxstock-offsite-${stampPart}${ext}`;
    const where = [], t0 = Date.now();
    for (const d of dests) {
      const up = await uploadVerified(db, d, snap, remoteName);
      let thinned = 0; try { thinned = await pruneRemote(clientFor(d), 'myboxstock-offsite-', tiers.offsite.thin); } catch (e) { L.warn('offsite.thin_failed', `Could not tidy old copies at "${d.name}": ${e.message}`, { data: { id: d.id } }); }
      where.push({ id: d.id, name: d.name, file: up.name, size: up.size, encrypted: up.encrypted, hashChecked: up.hashChecked });
      L.info('offsite.ok', `Offsite copy ${up.name} sent to "${d.name}" and checked (${(up.size / 1024).toFixed(0)} KB, ${Date.now() - t0} ms${thinned ? `, ${thinned} old thinned out` : ''})`, { actor, data: { destination: d.name, size: up.size, trigger, hashChecked: up.hashChecked } });
    }
    await recordTier(db, 'offsite', { lastAttemptAt: Date.now(), lastOk: { at: Date.now(), name: remoteName, size: where[0].size, verified: true, trigger, where } });
    audit('backup.run', `Offsite copy sent to ${where.map(w => w.name).join(', ')} (${trigger})`, { actor, data: { tier: 'offsite', trigger, ok: true, destinations: where.map(w => w.name) } });
    return { ok: true, name: remoteName, where };
  } catch (e) { return failed(db, 'offsite', e, actor, trigger); }
  finally { if (snap) fs.rmSync(snap, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
}

// Safety copies (taken before a restore): older than keepDays go, but the newest keepMin always stay.
export function pruneSafety({ keepDays, keepMin }, now = Date.now()) {
  const list = listBackups().filter(b => b.tier === 'safety' && !b.legacy).sort((a, b) => b.takenAt - a.takenAt); let n = 0;
  for (const b of list.slice(keepMin)) if (now - b.takenAt > keepDays * 86400e3) { deleteBackup(b.name, 'scheduler'); L.info('safety.pruned', `Removed old safety copy ${b.name}`, { data: { name: b.name } }); n++; }
  return n;
}

// Called every minute from the scheduler; starts whichever tier is due, never two at once.
const lastTry = {};
export async function tickTiers(db, now = Date.now()) {
  const tiers = await getTiers(db), st = await getTierStatus(db);
  for (const tier of ['frequent', 'offsite']) {
    const t = tiers[tier]; if (!t.enabled) continue;
    const last = Math.max(lastTry[tier] || 0, st[tier]?.lastAttemptAt || 0);
    if (now - last < t.everyMinutes * 60000 - 5000) continue;
    lastTry[tier] = now;
    await withBackupLock(`the ${tier === 'frequent' ? 'snapshot' : 'offsite copy'}`, () => tier === 'frequent' ? runFrequent(db) : runOffsite(db));
  }
  pruneSafety(tiers.safety, now);
}
export const resetTimersForTests = () => { for (const k of Object.keys(lastTry)) delete lastTry[k]; };
