// SERVICES / backup / health — one read-only picture of how healthy the backups are: the Backups card on the Host Overview and the backup Alerts.
// Counts, names of destinations and times only. Nothing inside an account is read. Settings used: backup_test_last (last test restore) and backup_health_since.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { getSetupRecord } from './gate.mjs';
import { backupOverview } from './overview.mjs';
import { getFullConfig, getFullStatus } from './auto.mjs';
import { getTierStatus, tierFailing } from './status.mjs';
import { getTiers } from './tiers.mjs';
import { listDestinations } from './destinations/index.mjs';
import { currentJob } from './jobs.mjs';

const L = areaLogger('backup');
const DAY = 86400e3;
export const TEST_WINDOW_DAYS = 30;
export const SPACE_LOW_PCT = 5; // free space at or below this share of the disk counts as nearly full
const TEST_KEY = 'backup_test_last', SINCE_KEY = 'backup_health_since';

// Remembered by testRestore and testOffsiteCopy, whichever way they were started. A failed test never hides the last good one.
export async function recordTestResult(db, { ok, name, kind = 'snapshot' }) {
  try {
    const cur = await getSetting(db, TEST_KEY, {}), at = Date.now();
    await setSetting(db, TEST_KEY, ok ? { ...cur, pass: { at, name, kind } } : { ...cur, fail: { at, name, kind } });
    L.info('health.test_recorded', `Test restore of ${name} recorded (${ok ? 'passed' : 'failed'})`, { data: { name, ok, kind } });
  } catch (e) { L.warn('health.test_record_failed', `Could not remember the test restore: ${e.message}`); }
}
// Nearly full: 5% or less of the disk is free, or there is not room for two more copies of the newest backup.
export const isSpaceLow = ({ free, total }, newestBytes = 0) => {
  if (free == null || !total) return false;
  return Math.round(free / total * 100) <= SPACE_LOW_PCT || (newestBytes > 0 && free < 2 * newestBytes);
};
export const fullWindowDays = (cfg) => (cfg.frequency === 'weekly' ? 8 : 2);

export async function backupHealth(db, now = Date.now()) {
  const ov = await backupOverview(db, now), full = await getFullConfig(db), fs_ = await getFullStatus(db), st = await getTierStatus(db), tiers = await getTiers(db);
  const rec = await getSetupRecord(db), test = await getSetting(db, TEST_KEY, {}), dests = (await listDestinations(db)).filter(d => !d.builtin);
  const snap = st.frequent?.lastOk || null, lastFull = fs_.lastOk || null, haveAny = !!ov.last;
  // Destination status: last send and last failure, from the offsite tier and the full-site backup.
  const offIds = new Set(tiers.offsite.destinations || []), fullIds = new Set(full.destinationIds || []);
  const destinations = dests.filter(d => d.enabled).map(d => {
    const sends = [], fails = [];
    if (st.offsite?.lastOk?.where?.some(w => w.id === d.id)) sends.push(st.offsite.lastOk.at);
    if (lastFull?.destinations?.includes(d.name)) sends.push(lastFull.at);
    if (offIds.has(d.id) && st.offsite?.lastFail) fails.push(st.offsite.lastFail);
    if (fullIds.has(d.id) && fs_.lastFail) fails.push(fs_.lastFail);
    const lastSend = sends.length ? Math.max(...sends) : null, lastFail = fails.sort((a, b) => b.at - a.at)[0] || null;
    const failing = (offIds.has(d.id) && tierFailing(st.offsite)) || (fullIds.has(d.id) && tierFailing({ lastOk: fs_.lastOk, lastFail: fs_.lastFail })) || d.lastTest?.ok === false;
    return { id: d.id, name: d.name, lastSend, lastFailAt: lastFail?.at ?? (d.lastTest?.ok === false ? d.lastTest.at : null), failing: !!failing };
  });
  // Baseline for "never tested": the first time a backup was seen, so a new install is not flagged on its first day.
  let since = await getSetting(db, SINCE_KEY, null);
  if (!since && haveAny) { since = now; try { await setSetting(db, SINCE_KEY, since); } catch {} }
  const testAt = test.pass?.at ?? null, testAge = testAt ? now - testAt : null;
  const space = ov.space, freePct = space.total ? Math.round(space.free / space.total * 100) : null;
  const spaceLow = isSpaceLow(space, Math.max(lastFull?.size || 0, snap?.size || 0));
  const job = currentJob(), jobFailed = job && job.status === 'failed' ? job : null;
  const winDays = fullWindowDays(full), fullLate = !!full.enabled && (!lastFull || now - lastFull.at > winDays * DAY);
  const testLate = haveAny && ((testAt ? now - testAt : now - (since || now)) > TEST_WINDOW_DAYS * DAY);
  const failingDests = destinations.filter(d => d.failing);
  const protectedNow = !!ov.offsite.exists && !!rec?.offsiteVerified;

  const problems = [];
  const link = ' Open Backups.';
  if (fullLate) problems.push({ kind: 'backup.nofull', level: 'error', title: 'No recent full-site backup', detail: lastFull ? `The last good full-site backup was more than ${winDays} days ago.${link}` : `No full-site backup has completed yet, and they are switched on.${link}` });
  if (failingDests.length) problems.push({ kind: 'backup.destination', level: 'error', title: 'A backup destination is failing', detail: `${failingDests.length} destination${failingDests.length === 1 ? ' is' : 's are'} failing: ${failingDests.map(d => d.name).join(', ').slice(0, 300)}.${link}` });
  if (testLate) problems.push({ kind: 'backup.notest', level: 'warn', title: 'No recent test restore', detail: testAt ? `The last passing test restore was ${Math.floor(testAge / DAY)} days ago. Run one every ${TEST_WINDOW_DAYS} days.${link}` : `No test restore has passed yet. Run one at least every ${TEST_WINDOW_DAYS} days.${link}` });
  if (spaceLow) problems.push({ kind: 'backup.space', level: 'error', title: 'The backup folder is nearly full', detail: `${freePct}% of the disk is free, which leaves little room for the next backups.${link}` });
  if (jobFailed) problems.push({ kind: 'backup.job', level: 'warn', title: 'A background backup job failed', detail: `${String(jobFailed.label).slice(0, 80)} failed.${link}` });
  const kinds = ['backup.nofull', 'backup.destination', 'backup.notest', 'backup.space', 'backup.job'];

  return {
    snapshot: snap ? { at: snap.at, size: snap.size ?? null } : null,
    full: { enabled: !!full.enabled, windowDays: winDays, last: lastFull ? { at: lastFull.at, size: lastFull.size } : null, late: fullLate, failedAt: fs_.lastFail && tierFailing({ lastOk: fs_.lastOk, lastFail: fs_.lastFail }) ? fs_.lastFail.at : null },
    test: { windowDays: TEST_WINDOW_DAYS, lastPass: test.pass || null, lastFail: test.fail && (!test.pass || test.fail.at > test.pass.at) ? test.fail : null, ageMs: testAge, late: testLate },
    offServer: { exists: !!ov.offsite.exists, where: ov.offsite.where, configured: ov.offsite.configured },
    destinations, space: { free: space.free, total: space.total, used: space.used, freePct, low: spaceLow },
    job: jobFailed ? { label: jobFailed.label, at: jobFailed.finishedAt } : null,
    protected: protectedNow, problems, kinds,
  };
}
