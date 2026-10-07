// SERVICES / backup / setup — the guided "Backup setup" on the Backups page: four steps that unlock one after another, and the status line.
//   1 passphrase (set, confirmed, saved elsewhere)  2 where copies go (off this server or not; a destination must pass Test connection)
//   3 how much to keep (Recommended, Minimal, Custom, with the estimated disk use)  4 prove it (first backup, then a test restore).
// Everything is written to the audit trail by name only; the passphrase never appears in a log or a response.
import { seal } from '../../auth/secrets.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { snapshot } from '../system/metrics.mjs';
import { mailReady } from '../mail/direct.mjs';
import { coded, getSetupRecord, updateSetupRecord } from './gate.mjs';
import { getTiers, saveTiers } from './tiers.mjs';
import { getFullConfig, runFullBackup, DEFAULT_FULL } from './auto.mjs';
import { runOffsite } from './runner.mjs';
import { databaseBytes, backupOverview } from './overview.mjs';
import { estimateCost } from './cost.mjs';
import { listDestinations } from './destinations/index.mjs';
import { testRestore } from './testrestore.mjs';
import { audit } from './audit.mjs';
import { MIN_PASSPHRASE } from './bundle.mjs';
import { testLatestOffsite } from './offsite.mjs';

const L = areaLogger('backup');
export const MAIL_NOTE = 'Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway.';
export const KEEP = {
  recommended: { label: 'Recommended', desc: 'Every copy for a day, then one an hour for two days, one a day for two weeks and one a week for eight weeks.', thin: { fullHours: 24, hourlyHours: 48, dailyDays: 14, weeklyWeeks: 8 } },
  minimal: { label: 'Minimal', desc: 'Every copy for six hours, then one an hour for half a day, then one a day for a week. Uses the least disk.', thin: { fullHours: 6, hourlyHours: 12, dailyDays: 7, weeklyWeeks: 0 } },
  custom: { label: 'Custom', desc: 'You choose every number on the Frequent snapshots and Offsite copies tabs. Your current numbers are kept.', thin: null },
};
const STEPS = [['passphrase', 'Passphrase'], ['where', 'Where do copies go'], ['keep', 'How much to keep'], ['prove', 'Prove it']];

export async function getSetup(db) {
  const rec = await getSetupRecord(db), full = await getFullConfig(db), dests = await listDestinations(db), tiers = await getTiers(db);
  const legacy = rec ? !!rec.legacy : !!full.hasPassphrase, confirmed = legacy || !!rec?.passphraseConfirmed;
  const pass = !!full.hasPassphrase && confirmed, usable = dests.filter(d => !d.builtin && d.enabled && d.tested), anyDest = dests.some(d => !d.builtin);
  const where = legacy || (pass && (rec?.offServer === false || (rec?.offServer === true && usable.length > 0)));
  const keep = legacy || (where && !!rec?.keepChoice), prove = legacy || (keep && !!rec?.proven?.ok);
  const done = { passphrase: pass, where, keep, prove }, steps = []; let open = true;
  for (const [id, label] of STEPS) { steps.push({ id, label, done: done[id], locked: !open }); open = open && done[id]; }
  const ov = await backupOverview(db), offsiteExists = !!ov.offsite.exists;
  const status = offsiteExists && rec?.offsiteVerified ? 'verified' : offsiteExists ? 'copy' : 'local';
  const reason = pass ? '' : 'Locked until the backup passphrase is set and confirmed (Backup setup, step 1). These copies are encrypted with it.';
  const dbBytes = await databaseBytes(db), disk = snapshot().disk;
  const keepOptions = Object.entries(KEEP).map(([id, k]) => {
    const thin = k.thin || tiers.frequent.thin, c = estimateCost({ dbBytes, frequent: { ...tiers.frequent, enabled: true, thin }, offsite: { ...tiers.offsite, thin }, full: { ...full, destinations: full.destinationIds }, safety: tiers.safety, freeBytes: disk?.free ?? null, usedByBackupsBytes: ov.space.used });
    return { id, label: k.label, desc: k.desc, line: c.line, warning: c.warning };
  });
  return {
    legacy, complete: Object.values(done).every(Boolean), steps, status,
    statusLabel: status === 'verified' ? 'Off-site and verified' : status === 'copy' ? 'Copy off this server' : 'Local only (same disk)',
    statusNote: status === 'local' ? 'Copies are on the same disk as the database. If the disk or machine is lost, so are they.' : status === 'copy' ? 'A copy is held away from this server, but it has not been tested yet. Open an offsite copy and run Test restore.' : 'A copy is held away from this server and a test restore of it passed.',
    passphrase: { set: !!full.hasPassphrase, confirmed, minLength: MIN_PASSPHRASE },
    where: { offServer: rec?.offServer ?? (legacy ? (anyDest || offsiteExists) : null), tested: usable.map(d => d.name), hasDestination: anyDest },
    keep: { choice: rec?.keepChoice ?? null, options: keepOptions },
    prove: { at: rec?.proven?.at ?? null, ok: rec?.proven ? !!rec.proven.ok : legacy, checks: rec?.proven?.checks ?? [], name: rec?.proven?.name ?? '' },
    locks: { offsite: reason, full: reason, destinations: reason },
    mail: { ready: await mailReady(db), note: MAIL_NOTE },
  };
}

// Step 1. With a passphrase: sets it (typed twice, saved-elsewhere ticked). Without one: only records that the existing passphrase is saved elsewhere.
export async function setupPassphrase(db, { passphrase = '', confirm = '', saved = false } = {}, actor) {
  const has = !!(await getSetting(db, 'backup_full', {})).passphrase;
  if (passphrase) {
    if (has) throw coded('HOST_BACKUP_PASSPHRASE_EXISTS');
    if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE) throw coded('HOST_BACKUP_PASSPHRASE_SHORT');
    if (passphrase !== confirm) throw coded('HOST_BACKUP_PASSPHRASE_MISMATCH');
  } else if (!has) throw coded('HOST_BACKUP_PASSPHRASE_SHORT');
  if (saved !== true) throw coded('HOST_BACKUP_PASSPHRASE_UNSAVED');
  await updateSetupRecord(db, { passphraseConfirmed: true });
  if (passphrase) await setSetting(db, 'backup_full', { ...DEFAULT_FULL, ...(await getSetting(db, 'backup_full', {})), passphrase: seal(passphrase) });
  audit('backup.setup_passphrase', passphrase ? 'Backup setup: the backup passphrase was set and confirmed as saved elsewhere' : 'Backup setup: the existing backup passphrase was confirmed as saved elsewhere', { actor, data: { step: 'passphrase' } });
  L.info('setup.passphrase', 'Backup setup step 1 done (passphrase set and confirmed)', { actor });
  return getSetup(db);
}

async function need(db, step) {
  const s = await getSetup(db), i = STEPS.findIndex(x => x[0] === step);
  if (s.steps.slice(0, i).some(x => !x.done)) throw coded('HOST_BACKUP_SETUP_LOCKED');
  return s;
}
// Step 2.
export async function setupWhere(db, { offServer }, actor) {
  await need(db, 'where');
  if (typeof offServer !== 'boolean') throw coded('HOST_BACKUP_WHERE_BAD');
  await updateSetupRecord(db, { offServer });
  audit('backup.setup_where', `Backup setup: copies ${offServer ? 'will also go off this server' : 'stay on this server only (acknowledged)'}`, { actor, data: { step: 'where', offServer } });
  return getSetup(db);
}
// Step 3. Recommended and Minimal write the thinning numbers for snapshots and offsite copies; Custom keeps whatever is set.
export async function setupKeep(db, { choice }, actor) {
  await need(db, 'keep');
  if (!KEEP[choice]) throw coded('HOST_BACKUP_KEEP_BAD');
  if (KEEP[choice].thin) await saveTiers(db, { frequent: { thin: KEEP[choice].thin }, offsite: { thin: KEEP[choice].thin } }, actor);
  await updateSetupRecord(db, { keepChoice: choice });
  audit('backup.setup_keep', `Backup setup: how much to keep set to ${KEEP[choice].label}`, { actor, data: { step: 'keep', choice } });
  return getSetup(db);
}
// Step 4. First backup (a full-site file, opened and checked as it is written), a test restore of it and, when copies go off this server,
// an offsite copy that is fetched back and tested.
export async function setupProve(db, actor) {
  await need(db, 'prove');
  const rec = await getSetupRecord(db), checks = []; let ok = true, name = '';
  const full = await runFullBackup(db, 'manual', actor);
  if (!full.ok) { ok = false; checks.push({ ok: false, label: 'The first backup is made and checked', detail: full.error }); }
  else {
    name = full.name; checks.push({ ok: true, label: 'The first backup is made and checked', detail: name });
    const t = await testRestore(db, name, { actor });
    checks.push({ ok: t.ok, label: 'A test restore of it passes', detail: t.summary }); ok = ok && t.ok;
  }
  if (ok && rec.offServer) {
    const tiers = await getTiers(db);
    if (!tiers.offsite.destinations.length) { const ids = (await listDestinations(db)).filter(d => !d.builtin && d.enabled && d.tested).map(d => d.id); await saveTiers(db, { offsite: { destinations: ids, enabled: true } }, actor); }
    const o = await runOffsite(db, { actor, trigger: 'manual' });
    if (!o.ok) { ok = false; checks.push({ ok: false, label: 'A copy is sent off this server', detail: o.error }); }
    else {
      checks.push({ ok: true, label: 'A copy is sent off this server', detail: o.where.map(w => w.name).join(', ') });
      const t = await testLatestOffsite(db, o.where[0].id, o.where[0].file, { actor }); checks.push({ ok: t.ok, label: 'The offsite copy is fetched back and a test restore of it passes', detail: t.summary }); ok = ok && t.ok;
    }
  }
  await updateSetupRecord(db, { proven: { ok, at: Date.now(), name, checks } });
  audit('backup.setup_prove', `Backup setup: first backup and test restore ${ok ? 'passed' : 'FAILED'}`, { actor, level: ok ? 'info' : 'warn', data: { step: 'prove', ok } });
  return { ok, checks, setup: await getSetup(db) };
}
