// SERVICES / backup / auto — scheduled full-site backups: nightly or weekly, passphrase kept sealed, verified after writing,
// optionally copied to a folder outside the data folder, old copies pruned (14 daily + 8 weekly by default), failures emailed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { seal, unseal } from '../../auth/secrets.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { createBundle, openBundle, MIN_PASSPHRASE } from './bundle.mjs';
import { backupDir, deleteBackup } from './files.mjs';
import { enqueueMail, processQueue } from '../mail/index.mjs';
import { enabledDestinations, uploadVerified, clientFor } from './destinations/index.mjs';
import { pruneRemoteCount, raiseFailing } from './runner.mjs';
import { audit } from './audit.mjs';
import { assertPassphraseReady } from './gate.mjs';

const L = areaLogger('backup');
export const DEFAULT_FULL = { enabled: false, frequency: 'nightly', hourUtc: 3, weekday: 0, keepDaily: 14, keepWeekly: 8, offboxDir: '', destinationIds: [], passphrase: '', emailOnFailure: true };
const clamp = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Math.floor(Number(v)) || d));

export async function getFullConfig(db, { reveal = false } = {}) {
  const c = { ...DEFAULT_FULL, ...(await getSetting(db, 'backup_full', {})) };
  if (reveal) { try { c.passphrase = c.passphrase ? unseal(c.passphrase) : ''; } catch { c.passphrase = ''; L.error('full.decrypt_failed', 'Could not read the stored backup passphrase (was the encryption key changed?)'); } }
  else { c.hasPassphrase = !!c.passphrase; delete c.passphrase; }
  return c;
}
export const getFullStatus = (db) => getSetting(db, 'backup_full_status', { lastOk: null, lastFail: null, lastAttemptDay: '' });

export async function saveFullConfig(db, p, actor) {
  const cur = await getFullConfig(db), raw = { ...DEFAULT_FULL, ...(await getSetting(db, 'backup_full', {})) };
  const next = {
    enabled: !!p.enabled, frequency: p.frequency === 'weekly' ? 'weekly' : 'nightly', hourUtc: clamp(p.hourUtc, 0, 23, 3), weekday: clamp(p.weekday, 0, 6, 0),
    keepDaily: clamp(p.keepDaily, 1, 90, 14), keepWeekly: clamp(p.keepWeekly, 1, 52, 8), offboxDir: String(p.offboxDir || '').trim().slice(0, 300), destinationIds: p.destinationIds === undefined ? raw.destinationIds || [] : [...new Set((Array.isArray(p.destinationIds) ? p.destinationIds : []).map(String).filter(x => x !== 'local'))], emailOnFailure: p.emailOnFailure !== false,
    passphrase: raw.passphrase,
  };
  if (typeof p.passphrase === 'string' && p.passphrase) {
    if (p.passphrase.length < MIN_PASSPHRASE) throw new Error(`The backup passphrase must be at least ${MIN_PASSPHRASE} characters.`);
    next.passphrase = seal(p.passphrase);
  }
  if (next.enabled && !next.passphrase) throw new Error('Choose a backup passphrase (Backup setup, step 1) before turning scheduled backups on.');
  if (next.enabled && raw.passphrase) await assertPassphraseReady(db);
  if (next.offboxDir && !path.isAbsolute(next.offboxDir)) throw new Error('The off-box folder must be a full path, for example /backups.');
  if (next.destinationIds.length && (await enabledDestinations(db, next.destinationIds)).length !== next.destinationIds.length) throw new Error('One of the chosen destinations is turned off or no longer exists.');
  await setSetting(db, 'backup_full', next);
  L.info('full.saved', `Scheduled full-site backups: ${next.enabled ? `${next.frequency}${next.frequency === 'weekly' ? ' (day ' + next.weekday + ')' : ''} at ${next.hourUtc}:00 UTC, keep ${next.keepDaily} daily / ${next.keepWeekly} weekly, off-box ${next.offboxDir || 'not set'}` : 'off'}`, { actor, data: { ...next, passphrase: undefined, passphraseChanged: !!p.passphrase } });
  return { ...cur, ...next, passphrase: undefined, hasPassphrase: !!next.passphrase };
}

// Opens the finished file with the passphrase and checks that the database inside is really there and sound.
export function verifyBundleFile(file, passphrase) {
  const e = openBundle(fs.readFileSync(file), passphrase), m = JSON.parse(e['manifest.json'].toString());
  if (!e['secret.key']?.length) throw new Error('The backup is missing its encryption key.');
  if (m.engine === 'sqlite') {
    const tmp = path.join(os.tmpdir(), `mbs-verify-${process.pid}-${Date.now()}.db`); fs.writeFileSync(tmp, e['database.db']);
    try {
      const d = new DatabaseSync(tmp, { readOnly: true });
      try {
        const ok = d.prepare('PRAGMA integrity_check').get(); if (Object.values(ok)[0] !== 'ok') throw new Error('The database inside the backup failed its integrity check.');
        return { engine: m.engine, accounts: Number(d.prepare('SELECT COUNT(*) AS n FROM accounts').get().n), createdAt: m.createdAt };
      } finally { d.close(); }
    } finally { fs.rmSync(tmp, { force: true }); }
  }
  if (!e['database.sql']?.length || !/CREATE TABLE/i.test(e['database.sql'].toString('utf8', 0, 200000))) throw new Error('The database dump inside the backup looks empty.');
  return { engine: m.engine, createdAt: m.createdAt };
}

const prune = (dir, tag, keep) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.startsWith(`myboxstock-fullsite-${tag}-`) && f.endsWith('.mbsbak')).map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const x of files.slice(keep)) { fs.rmSync(path.join(dir, x.f), { force: true }); L.info('full.pruned', `Removed old ${tag} backup ${x.f} from ${dir}`, { data: { name: x.f, dir } }); }
};

async function notifyFailure(db, cfg, error) {
  if (!cfg.emailOnFailure) return;
  try {
    const admins = await db.all("SELECT email FROM host_admins WHERE email IS NOT NULL AND email <> ''");
    for (const a of admins) await enqueueMail(db, a.email, 'backup_failed', { when: new Date().toUTCString(), error: String(error).slice(0, 300) });
    if (admins.length) processQueue(db).catch(() => {});
  } catch (e) { L.error('full.notify_failed', `Could not queue the backup failure email: ${e.message}`); }
}

// One scheduled (or run-now) full-site backup. Never throws; the outcome is saved and logged.
export async function runFullBackup(db, trigger = 'scheduled', actor = 'scheduler') {
  const cfg = await getFullConfig(db, { reveal: true }), status = await getFullStatus(db), now = new Date(), t0 = Date.now();
  const weekly = cfg.frequency === 'weekly' || now.getUTCDay() === cfg.weekday, tag = cfg.frequency === 'weekly' ? 'weekly' : 'daily';
  status.lastAttemptDay = now.toISOString().slice(0, 10);
  try {
    if (!cfg.passphrase) throw new Error('No backup passphrase is stored. Enter one in Backups settings.');
    const name = await createBundle(db, cfg.passphrase, actor, tag), file = path.join(backupDir(), name);
    const v = verifyBundleFile(file, cfg.passphrase), size = fs.statSync(file).size;
    let weeklyName = null;
    if (cfg.frequency === 'nightly' && weekly) { weeklyName = name.replace('-fullsite-daily-', '-fullsite-weekly-'); fs.copyFileSync(file, path.join(backupDir(), weeklyName)); }
    let offbox = null;
    if (cfg.offboxDir) {
      fs.mkdirSync(cfg.offboxDir, { recursive: true });
      for (const n of [name, weeklyName].filter(Boolean)) { const dest = path.join(cfg.offboxDir, n); fs.copyFileSync(path.join(backupDir(), n), dest); if (fs.statSync(dest).size !== size) throw new Error(`The copy in ${cfg.offboxDir} is not the same size as the original.`); }
      prune(cfg.offboxDir, 'daily', cfg.keepDaily); prune(cfg.offboxDir, 'weekly', cfg.keepWeekly); offbox = cfg.offboxDir;
    }
    const sent = [];
    for (const d of await enabledDestinations(db, cfg.destinationIds)) { // the file is already encrypted by its passphrase; each upload is checked before anything local is trimmed
      for (const n of [name, weeklyName].filter(Boolean)) await uploadVerified(db, d, path.join(backupDir(), n), n);
      await pruneRemoteCount(clientFor(d), 'daily', cfg.keepDaily); await pruneRemoteCount(clientFor(d), 'weekly', cfg.keepWeekly); sent.push(d.name);
    }
    prune(backupDir(), 'daily', cfg.keepDaily); prune(backupDir(), 'weekly', cfg.keepWeekly);
    status.lastOk = { name, at: Date.now(), size, verified: true, accounts: v.accounts ?? null, engine: v.engine, offbox, destinations: sent, trigger };
    audit('backup.run', `Full-site backup ${name} made and verified (${trigger})`, { actor, data: { tier: 'full', name, size, trigger, ok: true, destinations: sent } });
    L.info('full.ok', `Scheduled full-site backup ${name} done and verified (${(size / 1024).toFixed(0)} KB, ${Date.now() - t0} ms${offbox ? ', copied to ' + offbox : ', no off-box copy'})`, { actor, data: { name, size, offbox, trigger, ms: Date.now() - t0 } });
    await setSetting(db, 'backup_full_status', status); return { ok: true, ...status.lastOk };
  } catch (e) {
    status.lastFail = { at: Date.now(), error: String(e.message).slice(0, 400), trigger };
    audit('backup.run', `Full-site backup failed (${trigger}): ${String(e.message).slice(0, 300)}`, { actor, level: 'error', data: { tier: 'full', trigger, ok: false } });
    L.error('full.failed', `Scheduled full-site backup failed: ${e.message}`, { actor, data: { error: e.message, trigger } });
    await setSetting(db, 'backup_full_status', status); await raiseFailing(db, 'The full-site backup is failing', e.message); await notifyFailure(db, cfg, e.message); return { ok: false, error: e.message };
  }
}

// Called every minute by the scheduler; runs at most once per day (weekly: on the chosen weekday).
export async function maybeRunFull(db, now = new Date()) {
  const cfg = await getFullConfig(db); if (!cfg.enabled) return null;
  if (now.getUTCHours() !== cfg.hourUtc || (cfg.frequency === 'weekly' && now.getUTCDay() !== cfg.weekday)) return null;
  const status = await getFullStatus(db); if (status.lastAttemptDay === now.toISOString().slice(0, 10)) return null;
  return runFullBackup(db, 'scheduled', 'scheduler');
}
