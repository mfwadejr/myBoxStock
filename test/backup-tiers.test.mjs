// TEST / backup-tiers — the Backups page API: tiers and settings, destinations (sealed credentials, passphrase rule), encrypted offsite copies,
// thinning on disk, test restore, restore confirmation data, the notice after a restore, the audit trail, the failure alert and the scheduler lock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, ROOT, sleep, readJsonl } from './helpers.mjs';
import { davSim, s3Sim } from './helpers-backup-sims.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase';
let srv, host, dav, s3;
const bdir = () => path.join(srv.dir, 'backup');
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base); dav = await davSim(); dav.init(); s3 = await s3Sim();
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Tier Boxes', email: 't@example.com', username: 'tim', password: PW });
});
test.after(() => { srv?.stop(); dav?.close(); s3?.close(); });
// Modules that read DATA_DIR when first loaded: load them once against a private folder, then take the variables away again so spawned servers are not affected.
let inprocDir;
async function inproc() {
  if (inprocDir) return inprocDir;
  inprocDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-inproc-')); const was = [process.env.DATA_DIR, process.env.LOG_DIR]; process.env.DATA_DIR = inprocDir; process.env.LOG_DIR = path.join(inprocDir, 'logs');
  await import('../src/core/config.mjs'); for (const [i, k] of ['DATA_DIR', 'LOG_DIR'].entries()) { if (was[i] === undefined) delete process.env[k]; else process.env[k] = was[i]; }
  return inprocDir;
}
test.after(() => { if (inprocDir) fs.rmSync(inprocDir, { recursive: true, force: true }); });
const davBody = (o = {}) => ({ type: 'webdav', name: 'Office DAV', enabled: true, settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: { password: dav.pass }, ...o });
// Destinations are saved switched off, must pass Test connection, and only then can be turned on (as the Backup setup requires).
async function addDest(c, body) {
  const made = await c.req('POST', '/api/host/backups/destinations', { ...body, enabled: false }); if (made.status !== 200) return made;
  const t = await c.req('POST', `/api/host/backups/destinations/${made.data.id}/test`); assert.equal(t.data.ok, true, t.data.message);
  return c.req('PUT', `/api/host/backups/destinations/${made.data.id}`, { ...body, enabled: true, secrets: {} });
}
// Changes a saved destination straight in the database (as if the far end changed its sign-in).
function tweakDest(dir, id, fn) { const d = new DatabaseSync(path.join(dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); try { const list = JSON.parse(d.prepare('SELECT v FROM settings WHERE k = ?').get('backup_destinations').v); fn(list.find(x => x.id === id)); d.prepare('UPDATE settings SET v = ? WHERE k = ?').run(JSON.stringify(list), 'backup_destinations'); } finally { d.close(); } }
const stored = (key) => { const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db'), { readOnly: true }); try { return d.prepare('SELECT v FROM settings WHERE k = ?').get(key)?.v || ''; } finally { d.close(); } };

test('settings: every number is validated in plain English, the defaults are the owner\'s, and the backup folder is /data/backup', async () => {
  const g = (await host.req('GET', '/api/host/backups')).data;
  assert.equal(g.tiers.frequent.everyMinutes, 15); assert.deepEqual(g.tiers.frequent.thin, { fullHours: 24, hourlyHours: 48, dailyDays: 14, weeklyWeeks: 8 });
  assert.equal(g.tiers.offsite.everyMinutes, 60); assert.equal(g.tiers.offsite.enabled, false); assert.deepEqual(g.tiers.safety, { keepDays: 30, keepMin: 5 });
  assert.equal(g.localDir, path.join(srv.dir, 'backup')); assert.equal(g.overview.counts.frequent, 166);
  assert.match(g.plainNote, /plain database files/); assert.match(g.overview.cost.line, /At these settings you will hold about/);
  const put = (b) => host.req('PUT', '/api/host/backups/tiers', b);
  for (const [b, re] of [[{ frequent: { everyMinutes: 1 } }, /5 to 1440/], [{ frequent: { thin: { fullHours: 0 } } }, /1 to 168/], [{ frequent: { thin: { dailyDays: 2.5 } } }, /whole number/], [{ safety: { keepDays: 0 } }, /1 to 3650/], [{ safety: { keepMin: 500 } }, /1 to 100/], [{ localDir: 'relative' }, /full path/], [{ offsite: { everyMinutes: 5 } }, /15 to 1440/]]) {
    const r = await put(b); assert.equal(r.status, 400, JSON.stringify(b)); assert.match(r.data.error, re);
  }
  assert.equal((await put({ offsite: { enabled: true } })).status, 400, 'offsite needs a destination');
  const ok = await put({ frequent: { everyMinutes: 30, thin: { fullHours: 12 } }, safety: { keepDays: 10, keepMin: 2 } }); assert.equal(ok.status, 200); assert.equal(ok.data.tiers.frequent.thin.fullHours, 12); assert.equal(ok.data.tiers.frequent.thin.hourlyHours, 48);
  await put({ frequent: { everyMinutes: 15, thin: { fullHours: 24 } }, safety: { keepDays: 30, keepMin: 5 } });
});

test('destinations: nothing outside the default folder can be enabled without the passphrase; secrets are sealed and never returned', async () => {
  let r = await host.req('POST', '/api/host/backups/destinations', davBody()); assert.equal(r.status, 400); assert.match(r.data.error, /Set the backup passphrase/);
  assert.equal((await host.req('POST', '/api/host/backups/destinations', davBody({ enabled: false }))).status, 200, 'saving it switched off is fine');
  const first = (await host.req('GET', '/api/host/backups/destinations')).data.destinations.find(d => d.name === 'Office DAV');
  assert.equal(first.enabled, false); await host.req('DELETE', `/api/host/backups/destinations/${first.id}`);
  assert.equal((await host.req('PUT', '/api/host/backups/full', { enabled: false, passphrase: PASS, keepDaily: 14, keepWeekly: 8 })).status, 200);
  r = await addDest(host, davBody()); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.secrets.password, 'saved'); assert.equal(r.data.encrypted, true);
  const all = JSON.stringify([(await host.req('GET', '/api/host/backups')).data, (await host.req('GET', '/api/host/backups/destinations')).data, r.data]);
  assert.ok(!all.includes(dav.pass), 'the destination password is never sent back'); assert.ok(!all.includes(PASS));
  assert.ok(!stored('backup_destinations').includes(dav.pass), 'and it is not stored in the clear'); assert.match(stored('backup_destinations'), /v1\./);
  assert.equal((await host.req('POST', '/api/host/backups/destinations', davBody())).status, 400, 'names are unique');
  assert.equal((await host.req('POST', '/api/host/backups/destinations', { type: 'webdav', name: 'Bad', settings: { url: 'ftp://x', username: 'u' }, secrets: { password: 'p' } })).status, 400);
  assert.equal((await host.req('POST', '/api/host/backups/destinations', { type: 's3', name: 'NoKey', enabled: false, settings: { bucket: 'b', accessKey: 'a' }, secrets: {} })).data.error, 'Enter the secret key.');
  // editing with a blank password keeps the saved one, and Test connection uses it
  r = await host.req('PUT', `/api/host/backups/destinations/${r.data.id}`, { name: 'Office DAV', enabled: true, settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: {} }); assert.equal(r.status, 200);
  const t = await host.req('POST', `/api/host/backups/destinations/${r.data.id}/test`); assert.equal(t.data.ok, true, t.data.message); assert.match(t.data.message, /written, read back and removed/);
  assert.deepEqual(fs.readdirSync(path.join(dav.root, 'dav', 'mbs')), [], 'the test file was removed again');
  const bad = await host.req('PUT', `/api/host/backups/destinations/${r.data.id}`, { name: 'Office DAV', enabled: false, settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: { password: 'wrong' } });
  const t2 = await host.req('POST', `/api/host/backups/destinations/${bad.data.id}/test`); assert.equal(t2.data.ok, false); assert.match(t2.data.message, /did not accept the user name and password/);
  await host.req('PUT', `/api/host/backups/destinations/${r.data.id}`, { name: 'Office DAV', enabled: false, settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: { password: dav.pass } });
  assert.equal((await host.req('PUT', `/api/host/backups/destinations/${r.data.id}`, { name: 'Office DAV', enabled: true, settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: {} })).data.code, 'HOST_BACKUP_DEST_TEST_FIRST', 'changed details must be tested again');
  assert.equal((await host.req('POST', `/api/host/backups/destinations/${r.data.id}/test`)).data.ok, true);
  assert.equal((await host.req('PUT', `/api/host/backups/destinations/${r.data.id}`, { name: 'Office DAV', enabled: true, settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: {} })).status, 200);
  const log = fs.readFileSync(path.join(srv.logDir, 'backup', 'backup.log'), 'utf8'); assert.ok(!log.includes(dav.pass) && !log.includes('wrong') && !log.includes(PASS));
});

test('frequent snapshot: taken online, checked, private, listed, and the status strip reports it', { skip: !sqlite && 'SQLite snapshots' }, async () => {
  const r = await host.req('POST', '/api/host/backups/run/frequent'); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.verified, true); assert.match(r.data.name, /^myboxstock-snap-.*\.db$/);
  assert.ok(fs.existsSync(path.join(bdir(), r.data.name))); assert.equal(fs.statSync(path.join(bdir(), r.data.name)).mode & 0o777, 0o600);
  assert.ok(!fs.existsSync(path.join(bdir(), r.data.name + '-wal')));
  const l = (await host.req('GET', '/api/host/backups/files?tier=frequent&limit=1')).data; assert.equal(l.rows[0].name, r.data.name); assert.equal(l.rows[0].tier, 'frequent'); assert.ok(l.total >= 1);
  const o = (await host.req('GET', '/api/host/backups')).data.overview; assert.equal(o.last.tier, 'frequent'); assert.equal(o.last.verified, true); assert.ok(o.next && o.space.used > 0);
  assert.equal((await host.req('GET', '/api/host/backups/files?tier=bogus')).status, 400);
});

test('thinning on disk: a frequent run removes the extra copies in older hours but never manual or safety copies', { skip: !sqlite && 'SQLite snapshots' }, async () => {
  const mk = (n) => { fs.writeFileSync(path.join(bdir(), n), 'x'); return n; }, d = new Date(new Date(Date.now() - 5 * 86400e3).setUTCHours(12, 0, 0, 0)), s = (min) => { const x = new Date(d.getTime() + min * 60000); return x.toISOString().replace(/[:T]/g, '-').slice(0, 19); };
  const a = mk(`myboxstock-snap-${s(0)}.db`), b = mk(`myboxstock-snap-${s(1)}.db`), c = mk(`myboxstock-snap-${s(2)}.db`), man = mk(`myboxstock-manual-${s(3)}.db`), pre = mk(`myboxstock-pre-restore-${s(4)}.db`);
  assert.equal((await host.req('POST', '/api/host/backups/run/frequent')).status, 200);
  const left = fs.readdirSync(bdir()); assert.ok(left.includes(a), 'the earliest copy in that day stays'); assert.ok(!left.includes(b) && !left.includes(c), 'the others in that day are thinned');
  assert.ok(left.includes(man) && left.includes(pre), 'manual and safety copies are never thinned');
  assert.ok((await host.req('GET', '/api/host/backups/files?tier=safety')).data.rows.some(x => x.name === pre));
});

test('offsite copy: compressed, encrypted with the passphrase before it leaves, checked, listed, downloadable, decryptable with the CLI', { skip: !sqlite && 'SQLite snapshots' }, async () => {
  const dest = (await host.req('GET', '/api/host/backups/destinations')).data.destinations.find(d => d.name === 'Office DAV');
  assert.equal((await host.req('PUT', '/api/host/backups/tiers', { offsite: { enabled: true, everyMinutes: 60, destinations: [dest.id] } })).status, 200);
  const r = await host.req('POST', '/api/host/backups/run/offsite'); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.match(r.data.name, /^myboxstock-offsite-.*\.db$/);
  const remote = fs.readdirSync(path.join(dav.root, 'dav', 'mbs')); assert.equal(remote.length, 1); assert.ok(remote[0].endsWith('.db.mbsenc'), remote[0]);
  const bytes = fs.readFileSync(path.join(dav.root, 'dav', 'mbs', remote[0])); assert.ok(bytes.subarray(0, 7).toString() === 'MBSENC1' && !bytes.includes(Buffer.from('SQLite format')) && !bytes.includes(Buffer.from('Tier Boxes')));
  assert.ok(!fs.readdirSync(bdir()).some(f => /offsite/.test(f)), 'the temporary snapshot is removed');
  const list = (await host.req('GET', '/api/host/backups/offsite')).data; assert.equal(list.total, 1); assert.equal(list.rows[0].destinationName, 'Office DAV'); assert.equal(list.rows[0].name, remote[0]);
  const o = (await host.req('GET', '/api/host/backups')).data.overview; assert.equal(o.offsite.exists, true); assert.deepEqual(o.offsite.where, ['Office DAV']);
  const dl = await fetch(`${srv.base}/api/host/backups/destinations/${dest.id}/files/${remote[0]}/download`, { headers: { Cookie: Object.entries(host.jar).map(([k, v]) => `${k}=${v}`).join('; ') } }); assert.equal(dl.status, 200);
  const enc = path.join(os.tmpdir(), 'mbs-dl-' + Date.now() + '.mbsenc'), out = enc + '.db'; fs.writeFileSync(enc, Buffer.from(await dl.arrayBuffer()));
  const cli = (pass) => spawnSync('node', ['server.mjs', 'decrypt-backup', enc, out], { cwd: ROOT, env: { ...process.env, DATA_DIR: os.tmpdir(), BACKUP_PASSPHRASE: pass }, encoding: 'utf8' });
  assert.notEqual(cli('wrong passphrase here').status, 0);
  const ok = cli(PASS); assert.equal(ok.status, 0, ok.stderr); assert.ok(fs.readFileSync(out).subarray(0, 15).toString() === 'SQLite format 3');
  const d = new DatabaseSync(out, { readOnly: true }); assert.equal(Number(d.prepare('SELECT COUNT(*) AS n FROM accounts').get().n), 1); d.close(); fs.rmSync(enc, { force: true }); fs.rmSync(out, { force: true });
  assert.equal((await host.req('DELETE', `/api/host/backups/destinations/${dest.id}/files/${remote[0]}`)).status, 200); assert.deepEqual(fs.readdirSync(path.join(dav.root, 'dav', 'mbs')), []);
  assert.equal((await host.req('DELETE', `/api/host/backups/destinations/${dest.id}/files/..%2Fx`)).status, 400);
});

test('offsite to S3-compatible storage: signed requests, the checksum is compared, full-site bundles go as they are, old copies are thinned remotely', { skip: !sqlite && 'SQLite snapshots' }, async () => {
  const s = await addDest(host, { type: 's3', name: 'Bucket', settings: { endpoint: s3.endpoint, region: s3.region, bucket: s3.bucket, prefix: 'site', accessKey: s3.access, pathStyle: true }, secrets: { secretKey: s3.secret } });
  assert.equal(s.status, 200, JSON.stringify(s.data)); assert.ok(!JSON.stringify(s.data).includes(s3.secret));
  assert.ok(!stored('backup_destinations').includes(s3.secret));
  const t = await host.req('POST', `/api/host/backups/destinations/${s.data.id}/test`); assert.equal(t.data.ok, true, t.data.message);
  const old = new Date(new Date(Date.now() - 5 * 86400e3).setUTCHours(12, 0, 0, 0)), nm = (m) => `site/myboxstock-offsite-${new Date(old.getTime() + m * 60000).toISOString().replace(/[:T]/g, '-').slice(0, 19)}.db.mbsenc`;
  for (const m of [0, 1, 2]) s3.store.set(nm(m), { data: Buffer.from('old'), t: Date.now() });
  await host.req('PUT', '/api/host/backups/tiers', { offsite: { enabled: true, destinations: [s.data.id] } });
  assert.equal((await host.req('POST', '/api/host/backups/run/offsite')).status, 200);
  const keys = [...s3.store.keys()]; assert.ok(keys.includes(nm(0)) && !keys.includes(nm(1)) && !keys.includes(nm(2)), 'thinned remotely like local files');
  assert.ok(keys.some(k => /site\/myboxstock-offsite-.*\.db\.mbsenc$/.test(k)));
  assert.ok(s3.seen.every(x => x.ok), 'every request was signed correctly');
  assert.equal((await host.req('PUT', '/api/host/backups/full', { enabled: true, frequency: 'nightly', hourUtc: 3, keepDaily: 2, keepWeekly: 1, destinationIds: [s.data.id], passphrase: '' })).status, 200);
  const f = await host.req('POST', '/api/host/backups/full/run'); assert.equal(f.status, 200, JSON.stringify(f.data));
  assert.ok([...s3.store.keys()].some(k => /site\/myboxstock-fullsite-daily-.*\.mbsbak$/.test(k)), 'the full-site file is already encrypted and goes unchanged');
  await host.req('PUT', '/api/host/backups/tiers', { offsite: { enabled: false } });
  await host.req('PUT', '/api/host/backups/full', { enabled: false, keepDaily: 14, keepWeekly: 8, destinationIds: [] });
});

test('test restore: a good snapshot passes with counts, a corrupt copy fails in plain English, a bundle checks its passphrase; the live data is untouched', { skip: !sqlite && 'SQLite-only' }, async () => {
  const snap = (await host.req('GET', '/api/host/backups/files?tier=frequent&limit=1')).data.rows[0].name;
  const before = JSON.stringify((await host.req('GET', '/api/host/accounts')).data);   // the only thing a test restore writes to the live site is the note of its own result (shown on the Overview); the accounts must not change
  let r = await host.req('POST', `/api/host/backups/${snap}/test-restore`, {}); assert.equal(r.status, 200); assert.equal(r.data.ok, true); assert.deepEqual(r.data.counts, { accounts: 1, users: 1 }); assert.match(r.data.summary, /passed/);
  assert.ok(r.data.checks.every(c => c.ok)); assert.ok(!fs.readdirSync(os.tmpdir()).some(f => f.startsWith('mbs-testrestore-') && fs.readdirSync(path.join(os.tmpdir(), f)).length), 'the scratch copy is gone');
  fs.writeFileSync(path.join(bdir(), 'myboxstock-manual-2026-01-01-00-00-00.db'), Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(8192, 7)]));
  r = await host.req('POST', '/api/host/backups/myboxstock-manual-2026-01-01-00-00-00.db/test-restore', {}); assert.equal(r.data.ok, false); assert.match(r.data.summary, /did not pass/); assert.match(r.data.summary, /Do not rely on it/);
  fs.writeFileSync(path.join(bdir(), 'myboxstock-manual-2026-01-02-00-00-00.db'), 'this is not a database at all, just text');
  r = await host.req('POST', '/api/host/backups/myboxstock-manual-2026-01-02-00-00-00.db/test-restore', {}); assert.equal(r.data.ok, false); assert.match(JSON.stringify(r.data.checks), /damaged, or it is not a SQLite database/);
  const b = await host.req('POST', '/api/host/backups/bundle', { passphrase: PASS }); const name = b.data.name;
  r = await host.req('POST', `/api/host/backups/${name}/test-restore`, { passphrase: 'not the passphrase!!' }); assert.equal(r.data.ok, false); assert.match(JSON.stringify(r.data.checks), /Wrong passphrase/);
  r = await host.req('POST', `/api/host/backups/${name}/test-restore`, {}); assert.equal(r.data.ok, true, JSON.stringify(r.data)); assert.match(JSON.stringify(r.data.checks), /passphrase opens the backup/);
  fs.writeFileSync(path.join(bdir(), 'myboxstock-manual-2026-01-03-00-00-00.sql'), 'nothing useful'); r = await host.req('POST', '/api/host/backups/myboxstock-manual-2026-01-03-00-00-00.sql/test-restore', {}); assert.equal(r.data.ok, false); assert.match(r.data.note, /only load SQLite/);
  assert.equal((await host.req('POST', '/api/host/backups/nope.db/test-restore', {})).status, 404);
  assert.equal(JSON.stringify((await host.req('GET', '/api/host/accounts')).data), before, 'the live accounts were not touched');
  for (const f of fs.readdirSync(bdir()).filter(f => /2026-01-0/.test(f))) fs.rmSync(path.join(bdir(), f));
});

test('restore: the confirmation names the file, the exact time and how long ago; after the restart a site-wide notice is posted; the audit trail has it all', { skip: !sqlite && 'SQLite-only' }, async () => {
  const snap = (await host.req('GET', '/api/host/backups/files?tier=frequent&limit=1')).data.rows[0], info = (await host.req('GET', `/api/host/backups/${snap.name}/restore-info`)).data;
  assert.equal(info.name, snap.name); assert.equal(info.canRestore, true); assert.equal(info.safetyCopy, true); assert.equal(info.restarts, true); assert.equal(info.needsPassphrase, false);
  assert.match(info.takenAtText, /^\d{4}-\d\d-\d\d \d\d:\d\d UTC$/); assert.ok(info.agoMs >= 0 && info.agoMs < 600000); assert.equal(info.takenAt, snap.takenAt);
  assert.equal((await host.req('GET', '/api/host/backups/nope.db/restore-info')).status, 404);
  assert.equal((await host.req('POST', `/api/host/backups/${snap.name}/restore`, { confirm: 'no' })).status, 400);
  assert.equal((await host.req('GET', '/api/host/settings')).data.announcement.enabled, false);
  const audit = (await host.req('GET', '/api/host/audit?q=backup.')).data.rows;
  for (const e of ['backup.run', 'backup.destination_saved', 'backup.destination_deleted', 'backup.test_restore', 'backup.delete', 'backup.settings_saved']) assert.ok(audit.some(r => r.event === e && r.actor), `audit has ${e}`);
  assert.ok(audit.some(r => r.event === 'backup.run' && r.actor === 'admin'), 'manual runs name who did it');
  assert.ok(!JSON.stringify(audit).includes(dav.pass) && !JSON.stringify(audit).includes(PASS), 'no secrets in audit entries');
  assert.equal((await host.req('POST', `/api/host/backups/${snap.name}/restore`, { confirm: 'RESTORE' })).status, 200);
  await new Promise(r => srv.proc.once('exit', r));
  const b = await startServer({ DATA_DIR: srv.dir }), h2 = new Client(b.base);
  try {
    assert.equal((await h2.req('POST', '/api/host/login', { login: 'admin', password: PW })).status, 200);
    const a = (await h2.req('GET', '/api/host/settings')).data.announcement;
    assert.equal(a.enabled, true); assert.equal(a.level, 'important'); assert.match(a.text, /^The site was restored from a backup taken \d{4}-\d\d-\d\d \d\d:\d\d UTC\. Sales or changes made after that time may be missing\. Please check your recent activity\.$/);
    assert.ok(a.text.includes(info.takenAtText)); assert.ok(!fs.existsSync(path.join(srv.dir, 'restore-note.json')), 'the note is used once');
    const off = await h2.req('PUT', '/api/host/settings/announcement', { enabled: false, text: a.text, level: 'important', until: '' }); assert.equal(off.status, 200, 'the Host clears it like any announcement');
    assert.equal((await h2.req('GET', '/api/host/settings')).data.announcement.enabled, false);
    assert.ok(fs.readdirSync(path.join(srv.dir, 'backup')).some(f => f.startsWith('myboxstock-pre-restore-')), 'a safety copy was taken first');
    assert.ok(readJsonl(srv.logDir, 'host').some(e => e.event === 'backup.restore' && e.actor === 'admin' && e.level === 'warn'), 'the restore itself is in the audit log');
  } finally { b.stop(); srv = null; }
});

// ---- no server needed: the scheduler lock and failure handling ----
test('scheduler lock: two backups never overlap; the second is told who is busy', async () => {
  const dir = await inproc();
  const { withBackupLock, backupBusy } = await import('../src/services/backup/runner.mjs');
  let release; const gate = new Promise(r => { release = r; }), order = [];
  const first = withBackupLock('the snapshot', async () => { order.push('first start'); await gate; order.push('first end'); return 1; });
  await sleep(20); assert.equal(backupBusy(), 'the snapshot');
  const second = await withBackupLock('the offsite copy', async () => { order.push('second ran'); }); assert.deepEqual(second, { skipped: true, by: 'the snapshot' });
  release(); assert.deepEqual(await first, { skipped: false, value: 1 }); assert.equal(backupBusy(), '');
  assert.deepEqual((await withBackupLock('again', async () => 2)).value, 2); assert.deepEqual(order, ['first start', 'first end']);
  await assert.rejects(withBackupLock('boom', async () => { throw new Error('x'); }), /x/); assert.equal(backupBusy(), '', 'the lock is released after a failure');
});

test('failure: a destination that stops working is logged, audited, raises the backup alert, and clears after a good run', { skip: !sqlite && 'SQLite snapshots' }, async () => {
  const s2 = await startServer(), h = new Client(s2.base), d2 = await davSim(); d2.init();
  try {
    await h.req('POST', '/api/host/login', { login: 'admin', password: s2.hostPw }); await h.req('POST', '/api/host/change-password', { current: s2.hostPw, next: PW });
    await h.req('PUT', '/api/host/backups/full', { enabled: false, passphrase: PASS, keepDaily: 14, keepWeekly: 8 });
    const dd = (await addDest(h, { type: 'webdav', name: 'Flaky', settings: { url: d2.url, username: d2.user }, secrets: { password: d2.pass } })).data;
    await h.req('PUT', '/api/host/backups/tiers', { offsite: { enabled: true, destinations: [dd.id] } });
    assert.equal((await h.req('POST', '/api/host/backups/run/offsite')).status, 200);
    tweakDest(s2.dir, dd.id, (x) => { x.settings.username = 'changed-on-the-server'; });
    const bad = await h.req('POST', '/api/host/backups/run/offsite'); assert.equal(bad.status, 400); assert.match(bad.data.error, /did not accept the user name and password/);
    let a = (await h.req('GET', '/api/host/alerts')).data.open; assert.equal(a.filter(x => x.kind === 'backup.failing').length, 1, 'the existing backup-failing alert is raised straight away');
    assert.match(a[0].detail, /Offsite copies are failing/); assert.ok(!JSON.stringify(a).includes(d2.pass));
    a = (await h.req('POST', '/api/host/alerts/check')).data.open; assert.equal(a.filter(x => x.kind === 'backup.failing').length, 1, 'it stays raised while the failure is the latest result');
    const ov = (await h.req('GET', '/api/host/backups')).data.overview; assert.equal(ov.failing.offsite, true); assert.match(ov.failing.detail.offsite.error, /user name and password/);
    assert.ok(readJsonl(s2.logDir, 'backup').some(e => e.event === 'offsite.failed' && e.level === 'error'));
    assert.ok(readJsonl(s2.logDir, 'host').some(e => e.event === 'backup.run' && e.level === 'error' && /failed/.test(e.message)));
    tweakDest(s2.dir, dd.id, (x) => { x.settings.username = d2.user; });
    assert.equal((await h.req('POST', '/api/host/backups/run/offsite')).status, 200);
    a = (await h.req('POST', '/api/host/alerts/check')).data.open; assert.equal(a.filter(x => x.kind === 'backup.failing').length, 0, 'cleared after a good copy');
  } finally { s2.stop(); d2.close(); }
});

test('scheduler: a due tier runs by itself, only once per interval, and safety copies are tidied', { skip: !sqlite && 'SQLite snapshots' }, async () => {
  const dir = await inproc(); fs.rmSync(path.join(dir, 'backup'), { recursive: true, force: true });
  const { initDb } = await import('../src/db/connection.mjs'), { attachLogDb } = await import('../src/logging/logger.mjs');
  const { tickTiers, resetTimersForTests, pruneSafety } = await import('../src/services/backup/runner.mjs'), { listBackups } = await import('../src/services/backup/files.mjs');
  const db = await initDb({ client: 'sqlite', file: path.join(dir, 'myboxstock.db') }); attachLogDb(db);
  try {
    resetTimersForTests(); await tickTiers(db); assert.equal(listBackups().filter(b => b.label === 'snap').length, 1, 'first tick takes a snapshot');
    await tickTiers(db, Date.now() + 60000); assert.equal(listBackups().filter(b => b.label === 'snap').length, 1, 'one minute later nothing is due');
    await sleep(1100); await tickTiers(db, Date.now() + 16 * 60000); assert.equal(listBackups().filter(b => b.label === 'snap').length, 2, 'after the interval the next one is taken');
    const bd = path.join(dir, 'backup'), old = (n) => `myboxstock-pre-restore-${new Date(Date.now() - n * 86400e3).toISOString().replace(/[:T]/g, '-').slice(0, 19)}.db`;
    for (const n of [40, 41, 42, 1]) fs.writeFileSync(path.join(bd, old(n)), 'x');
    assert.equal(pruneSafety({ keepDays: 30, keepMin: 2 }), 2, 'the two oldest go; the newest 2 stay even though one is older than 30 days');
    assert.equal(listBackups().filter(b => b.tier === 'safety').length, 2);
    assert.equal(pruneSafety({ keepDays: 30, keepMin: 5 }), 0, 'the newest 5 are always kept');
  } finally { await db.close(); }
});
