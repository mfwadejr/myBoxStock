// TEST / backup-setup — the guided Backup setup (locked states, each step unlocking the next, existing installs shown as complete)
// and restoring from an offsite copy (mandatory test first, damaged and wrong-passphrase copies, unreachable destination, safety copy and undo, audit entries).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, allLogText, readJsonl, sleep } from './helpers.mjs';
import { davSim } from './helpers-backup-sims.mjs';
import { encryptFile } from '../src/services/backup/crypt.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase', API = '/api/host/backups';
let srv, host, dav;
const login = async (base, pw = PW) => { const c = new Client(base); await c.req('POST', '/api/host/login', { login: 'admin', password: pw }); return c; };
const davBody = (o = {}) => ({ type: 'webdav', name: 'Office DAV', settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: { password: dav.pass }, ...o });
const stepState = (s) => Object.fromEntries(s.steps.map(x => [x.id, x.done ? 'done' : x.locked ? 'locked' : 'open']));
const davDir = () => path.join(dav.root, 'dav', 'mbs');
function tweakDest(dir, id, fn) { const d = new DatabaseSync(path.join(dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); try { const list = JSON.parse(d.prepare('SELECT v FROM settings WHERE k = ?').get('backup_destinations').v); fn(list.find(x => x.id === id)); d.prepare('UPDATE settings SET v = ? WHERE k = ?').run(JSON.stringify(list), 'backup_destinations'); } finally { d.close(); } }

test.before(async () => {
  srv = await startServer(); dav = await davSim(); dav.init();
  host = await login(srv.base, srv.hostPw); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Setup Boxes', email: 's@example.com', username: 'sam', password: PW });
});
test.after(() => { srv?.stop(); dav?.close(); });

test('a fresh install: only step 1 is open, everything that needs the passphrase is locked with a reason, and status says Local only', { skip: !sqlite && 'SQLite-only' }, async () => {
  const s = (await host.req('GET', `${API}/setup`)).data;
  assert.deepEqual(stepState(s), { passphrase: 'open', where: 'locked', keep: 'locked', prove: 'locked' });
  assert.equal(s.complete, false); assert.equal(s.protected, false); assert.equal(s.legacy, false); assert.equal(s.status, 'local'); assert.equal(s.statusLabel, 'Local only (same disk)');
  for (const k of ['offsite', 'full', 'destinations']) assert.match(s.locks[k], /passphrase/);
  assert.equal(s.mail.ready, false); assert.equal(s.mail.note, 'Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway.');
  assert.deepEqual((await host.req('GET', API)).data.setup.steps.map(x => x.id), ['passphrase', 'where', 'keep', 'prove'], 'the page data carries the setup');
  // the server refuses too, not only the page
  for (const [path_, body] of [['/setup/where', { offServer: false }], ['/setup/keep', { choice: 'recommended' }], ['/setup/prove', {}]]) { const r = await host.req('POST', API + path_, body); assert.equal(r.status, 400, path_); assert.equal(r.data.code, 'HOST_BACKUP_SETUP_LOCKED'); }
  assert.equal((await host.req('PUT', `${API}/tiers`, { offsite: { enabled: true, destinations: ['x'] } })).status, 400);
  assert.equal((await host.req('PUT', `${API}/full`, { enabled: true })).status, 400, 'full-site backups cannot be turned on without a passphrase');
  const d = await host.req('POST', `${API}/destinations`, davBody({ enabled: true })); assert.equal(d.status, 400); assert.match(d.data.error, /passphrase/);
  assert.equal((await host.req('GET', `${API}/destinations`)).data.destinations.length, 1, 'no destination was saved');
  // frequent snapshots work from day one, with no passphrase
  assert.equal((await host.req('POST', `${API}/run/frequent`)).status, 200);
});

test('step 1: the passphrase is checked, typed twice, confirmed as saved elsewhere, kept sealed and never logged', { skip: !sqlite && 'SQLite-only' }, async () => {
  const set = (b) => host.req('POST', `${API}/setup/passphrase`, b);
  assert.equal((await set({ passphrase: 'short', confirm: 'short', saved: true })).data.code, 'HOST_BACKUP_PASSPHRASE_SHORT');
  assert.equal((await set({ passphrase: PASS, confirm: PASS + 'x', saved: true })).data.code, 'HOST_BACKUP_PASSPHRASE_MISMATCH');
  assert.equal((await set({ passphrase: PASS, confirm: PASS, saved: false })).data.code, 'HOST_BACKUP_PASSPHRASE_UNSAVED');
  assert.equal((await host.req('GET', `${API}/setup`)).data.passphrase.set, false, 'nothing was stored by the refused attempts');
  const r = await set({ passphrase: PASS, confirm: PASS, saved: true }); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(stepState(r.data), { passphrase: 'done', where: 'open', keep: 'locked', prove: 'locked' });
  assert.equal((await set({ passphrase: PASS + 'again', confirm: PASS + 'again', saved: true })).data.code, 'HOST_BACKUP_PASSPHRASE_EXISTS');
  const raw = new DatabaseSync(path.join(srv.dir, 'myboxstock.db'), { readOnly: true }).prepare("SELECT v FROM settings WHERE k = 'backup_full'").get().v; assert.ok(!raw.includes(PASS), 'sealed at rest');
  assert.ok(!JSON.stringify(r.data).includes(PASS) && !allLogText(srv.logDir).includes(PASS), 'never in a response or a log');
  await sleep(900); const audit = (await host.req('GET', '/api/host/audit?q=backup.setup')).data.rows; assert.ok(audit.some(e => e.event === 'backup.setup_passphrase' && e.actor === 'admin'));
});

test('step 2: a destination must pass Test connection (on exactly these details) before it can be turned on; the step needs a tested destination, or an acknowledged local-only choice', { skip: !sqlite && 'SQLite-only' }, async () => {
  assert.equal((await host.req('POST', `${API}/setup/where`, {})).data.code, 'HOST_BACKUP_WHERE_BAD');
  let s = (await host.req('POST', `${API}/setup/where`, { offServer: true })).data; assert.equal(s.steps[1].done, false, 'wanting an off-server copy is not enough without a tested destination');
  const on = await host.req('POST', `${API}/destinations`, davBody({ enabled: true })); assert.equal(on.status, 400); assert.equal(on.data.code, 'HOST_BACKUP_DEST_TEST_FIRST');
  const made = await host.req('POST', `${API}/destinations`, davBody({ enabled: false })); assert.equal(made.status, 200); assert.equal(made.data.tested, false);
  assert.equal((await host.req('PUT', `${API}/destinations/${made.data.id}`, davBody({ enabled: true, secrets: {} }))).data.code, 'HOST_BACKUP_DEST_TEST_FIRST', 'untested, so it stays off');
  const t = await host.req('POST', `${API}/destinations/${made.data.id}/test`); assert.equal(t.data.ok, true, t.data.message);
  const en = await host.req('PUT', `${API}/destinations/${made.data.id}`, davBody({ enabled: true, secrets: {} })); assert.equal(en.status, 200); assert.equal(en.data.tested, true);
  const changed = await host.req('PUT', `${API}/destinations/${made.data.id}`, davBody({ enabled: true, settings: { url: dav.url, username: dav.user, folder: 'other' }, secrets: {} })); assert.equal(changed.data.code, 'HOST_BACKUP_DEST_TEST_FIRST', 'changing the details means testing again');
  s = (await host.req('GET', `${API}/setup`)).data; assert.deepEqual(stepState(s), { passphrase: 'done', where: 'done', keep: 'open', prove: 'locked' }); assert.deepEqual(s.where.tested, ['Office DAV']);
});

test('step 3: Recommended, Minimal and Custom each show the estimated disk use; the choice unlocks step 4 and writes the numbers', { skip: !sqlite && 'SQLite-only' }, async () => {
  const s = (await host.req('GET', `${API}/setup`)).data; assert.deepEqual(s.keep.options.map(o => o.id), ['recommended', 'minimal', 'custom']);
  for (const o of s.keep.options) assert.match(o.line, /At these settings you will hold about/);
  assert.equal((await host.req('POST', `${API}/setup/keep`, { choice: 'huge' })).data.code, 'HOST_BACKUP_KEEP_BAD');
  const r = await host.req('POST', `${API}/setup/keep`, { choice: 'minimal' }); assert.equal(r.status, 200);
  assert.deepEqual(stepState(r.data), { passphrase: 'done', where: 'done', keep: 'done', prove: 'open' });
  const t = (await host.req('GET', API)).data.tiers; assert.deepEqual(t.frequent.thin, { fullHours: 6, hourlyHours: 12, dailyDays: 7, weeklyWeeks: 0 }); assert.deepEqual(t.offsite.thin, t.frequent.thin);
  assert.equal((await host.req('POST', `${API}/setup/keep`, { choice: 'recommended' })).status, 200); assert.equal((await host.req('GET', API)).data.tiers.frequent.thin.fullHours, 24);
});

test('step 4: Prove it runs the first backup and a test restore, fetches the offsite copy back, and only then is the setup complete and the status Off-site and verified', { skip: !sqlite && 'SQLite-only', timeout: 120000 }, async () => {
  const r = await host.req('POST', `${API}/setup/prove`, {}); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.ok, true, JSON.stringify(r.data.checks));
  assert.ok(r.data.checks.length >= 4 && r.data.checks.every(c => c.ok));
  const s = r.data.setup; assert.equal(s.complete, true); assert.deepEqual(stepState(s), { passphrase: 'done', where: 'done', keep: 'done', prove: 'done' });
  assert.equal(s.status, 'verified'); assert.equal(s.statusLabel, 'Off-site and verified'); assert.equal(s.protected, true, 'Protected only when copies leave the server and a test restore passed');
  assert.equal(fs.readdirSync(davDir()).filter(f => /offsite/.test(f)).length, 1, 'a copy is at the destination');
  await sleep(900); const audit = (await host.req('GET', '/api/host/audit?q=backup.setup')).data.rows; for (const e of ['backup.setup_where', 'backup.setup_keep', 'backup.setup_prove']) assert.ok(audit.some(x => x.event === e), e);
});

test('an install that already had a passphrase keeps nothing locked, but is not shown as protected unless copies leave the server', { skip: !sqlite && 'SQLite-only' }, async () => {
  const b = await startServer(); const h = await login(b.base, b.hostPw);
  try {
    await h.req('POST', '/api/host/change-password', { current: b.hostPw, next: PW });
    assert.equal((await h.req('PUT', `${API}/full`, { enabled: false, passphrase: PASS, keepDaily: 14, keepWeekly: 8 })).status, 200);
    const s = (await h.req('GET', `${API}/setup`)).data; assert.equal(s.legacy, true);
    // an existing install that sends nothing away is NOT shown as protected: step 2 stays open and the chip logic follows status, not "all done"
    assert.deepEqual(stepState(s), { passphrase: 'done', where: 'open', keep: 'done', prove: 'done' }); assert.equal(s.complete, false); assert.equal(s.protected, false); assert.equal(s.status, 'local'); assert.equal(s.statusLabel, 'Local only (same disk)');
    for (const k of ['offsite', 'full', 'destinations']) assert.equal(s.locks[k], '');
    assert.equal((await h.req('POST', `${API}/setup/where`, { offServer: false })).data.complete, true, 'answering step 2 completes the steps');
    assert.equal((await h.req('GET', `${API}/setup`)).data.protected, false, 'but complete is not protected: nothing leaves the server');
    assert.equal((await h.req('PUT', `${API}/full`, { enabled: true, passphrase: '', keepDaily: 14, keepWeekly: 8 })).status, 200, 'full-site backups can be turned on straight away');
  } finally { b.stop(); }
});

// ---------------- passphrase care: check, change, reset ----------------
test('Check, Change and Reset the backup passphrase: current one required, warnings, audit, never logged, and Test restore explains an earlier-passphrase copy', { skip: !sqlite && 'SQLite-only', timeout: 120000 }, async () => {
  const b = await startServer(), h = await login(b.base, b.hostPw).catch(() => null);
  try {
    const hh = h || await login(b.base); await hh.req('POST', '/api/host/change-password', { current: b.hostPw, next: PW });
    const P1 = 'first backup passphrase', P2 = 'second backup passphrase', P3 = 'third backup passphrase', pp = (x, body) => hh.req('POST', `${API}/setup/passphrase/${x}`, body);
    assert.equal((await pp('check', { passphrase: P1 })).data.code, 'HOST_BACKUP_PASSPHRASE_NONE', 'nothing to check before one is set');
    assert.equal((await hh.req('POST', `${API}/setup/passphrase`, { passphrase: P1, confirm: P1, saved: true })).status, 200);
    // check
    assert.equal((await pp('check', { passphrase: P1 })).data.match, true); assert.equal((await pp('check', { passphrase: P1 + 'x' })).data.match, false); assert.equal((await pp('check', {})).data.match, false);
    // make a full-site copy under P1, so it is older than the change
    const made = await hh.req('POST', `${API}/full/run`); assert.equal(made.status, 200, JSON.stringify(made.data)); const name = made.data.name;
    await sleep(1100);
    // change: wrong current refused (nothing changes), then the other checks, then success
    assert.equal((await pp('change', { current: 'not it at all!', next: P2, confirm: P2, saved: true })).data.code, 'HOST_BACKUP_PASSPHRASE_WRONG');
    assert.equal((await pp('change', { current: P1, next: 'short', confirm: 'short', saved: true })).data.code, 'HOST_BACKUP_PASSPHRASE_SHORT');
    assert.equal((await pp('change', { current: P1, next: P2, confirm: P2 + 'x', saved: true })).data.code, 'HOST_BACKUP_PASSPHRASE_MISMATCH');
    assert.equal((await pp('change', { current: P1, next: P2, confirm: P2, saved: false })).data.code, 'HOST_BACKUP_PASSPHRASE_UNSAVED');
    assert.equal((await pp('change', { current: P1, next: P1, confirm: P1, saved: true })).data.code, 'HOST_BACKUP_PASSPHRASE_SAME');
    assert.equal((await pp('check', { passphrase: P1 })).data.match, true, 'still the old one after every refusal');
    const ch = await pp('change', { current: P1, next: P2, confirm: P2, saved: true }); assert.equal(ch.status, 200, JSON.stringify(ch.data));
    assert.equal(ch.data.setup.passphrase.lastAction, 'change'); assert.ok(ch.data.setup.passphrase.changedAt);
    assert.equal((await pp('check', { passphrase: P2 })).data.match, true); assert.equal((await pp('check', { passphrase: P1 })).data.match, false);
    // the old Full-site field can no longer swap it without the current passphrase
    assert.equal((await hh.req('PUT', `${API}/full`, { enabled: false, passphrase: P3 + 'zzz', keepDaily: 14, keepWeekly: 8 })).data.code, 'HOST_BACKUP_PASSPHRASE_EXISTS');
    // Test restore of the copy made with the earlier passphrase says so
    const t = (await hh.req('POST', `${API}/${encodeURIComponent(name)}/test-restore`, {})).data; assert.equal(t.ok, false);
    assert.match(t.checks.find(c => !c.ok).detail, /made with an earlier passphrase.*changed on/); assert.match(t.summary, /earlier passphrase/);
    assert.equal((await hh.req('POST', `${API}/${encodeURIComponent(name)}/test-restore`, { passphrase: P1 })).data.ok, true, 'the old passphrase still opens it');
    // reset: needs the warning accepted; older copies are then unreadable for good
    assert.equal((await pp('reset', { next: P3, confirm: P3, saved: true })).data.code, 'HOST_BACKUP_RESET_UNACK');
    assert.equal((await pp('check', { passphrase: P3 })).data.match, false, 'nothing changed by the refusal');
    const rs = await pp('reset', { next: P3, confirm: P3, saved: true, acknowledge: true }); assert.equal(rs.status, 200, JSON.stringify(rs.data)); assert.equal(rs.data.setup.passphrase.lastAction, 'reset');
    assert.equal((await pp('check', { passphrase: P3 })).data.match, true);
    const t2 = (await hh.req('POST', `${API}/${encodeURIComponent(name)}/test-restore`, {})).data; assert.equal(t2.ok, false); assert.match(t2.checks.find(c => !c.ok).detail, /earlier passphrase.*reset on/);
    // audited by name and outcome, never with a passphrase
    await sleep(900); const rows = (await hh.req('GET', '/api/host/audit?q=backup.passphrase')).data.rows, ev = rows.map(r => r.event);
    for (const e of ['backup.passphrase_check', 'backup.passphrase_change', 'backup.passphrase_reset']) assert.ok(ev.includes(e), e);
    assert.ok(rows.some(r => r.event === 'backup.passphrase_change' && r.level === 'warn' && r.actor === 'admin'), 'the wrong-current attempt is a warning');
    const everything = allLogText(b.logDir) + JSON.stringify(rows); for (const x of [P1, P2, P3]) assert.ok(!everything.includes(x), 'no passphrase in any log or audit row');
    const raw = new DatabaseSync(path.join(b.dir, 'myboxstock.db'), { readOnly: true }).prepare("SELECT v FROM settings WHERE k IN ('backup_full', 'backup_setup')").all().map(r => r.v).join(''); for (const x of [P1, P2, P3]) assert.ok(!raw.includes(x), 'sealed or absent at rest');
  } finally { b.stop(); }
});

// ---------------- restore from an offsite copy ----------------
const offsiteName = () => fs.readdirSync(davDir()).find(f => /^myboxstock-offsite-.*\.db\.mbsenc$/.test(f));
const destId = async () => (await host.req('GET', `${API}/destinations`)).data.destinations.find(d => d.name === 'Office DAV').id;
const testCopy = async (name, extra = {}) => (await host.req('POST', `${API}/offsite/test`, { destination: await destId(), name, ...extra }));

test('Test restore on an offsite copy: every check passes, the live site is only counted, the scratch copy is gone, and the audit trail has it', { skip: !sqlite && 'SQLite-only' }, async () => {
  const name = offsiteName(), r = await testCopy(name); assert.equal(r.status, 200); const d = r.data;
  assert.equal(d.ok, true, JSON.stringify(d.checks)); assert.ok(d.token); assert.ok(d.checks.every(c => c.ok));
  const labels = d.checks.map(c => c.label).join('|'); for (const want of ['destination can be reached', 'can be fetched', 'passphrase opens the copy', 'integrity check', 'fits this version', 'compared with the live site', 'scratch copy was deleted']) assert.match(labels, new RegExp(want));
  assert.deepEqual(d.counts, { accounts: 1, users: 1, records: 0 }); assert.match(d.compare.line, /1 account, 1 user and 0 records/);
  assert.ok(!fs.readdirSync(os.tmpdir()).some(f => f.startsWith('mbs-offtest-')), 'the scratch copy is deleted');
  assert.ok(!JSON.stringify(d).includes(PASS));
  await sleep(900); const audit = (await host.req('GET', '/api/host/audit?q=backup.')).data.rows; assert.ok(audit.some(e => e.actor === 'admin' && /offsite copy/.test(e.message)));
});

test('Restore needs a passing test: no token, a stale token, the wrong confirmation and a changed file are all refused', { skip: !sqlite && 'SQLite-only' }, async () => {
  const name = offsiteName(), dest = await destId(), go = (b) => host.req('POST', `${API}/offsite/restore`, { destination: dest, name, confirm: 'RESTORE', ...b });
  assert.equal((await go({})).data.code, 'HOST_BACKUP_COPY_NOT_TESTED'); assert.equal((await go({ token: 'f'.repeat(48) })).data.code, 'HOST_BACKUP_COPY_NOT_TESTED');
  const t = (await testCopy(name)).data; assert.equal((await go({ token: t.token, confirm: 'yes' })).data.code, 'HOST_BACKUP_RESTORE_CONFIRM');
  assert.equal((await host.req('DELETE', `${API}/offsite/token/${t.token}`)).status, 200, 'closing the sheet drops the token'); assert.equal((await go({ token: t.token })).data.code, 'HOST_BACKUP_COPY_NOT_TESTED');
  const t2 = (await testCopy(name)).data, t3 = (await testCopy(name)).data; assert.equal((await go({ token: t2.token })).data.code, 'HOST_BACKUP_COPY_NOT_TESTED', 'testing again makes the earlier result stale');
  const file = path.join(davDir(), name), good = fs.readFileSync(file), edit = Buffer.from(good); edit[edit.length - 40] ^= 0xff; fs.writeFileSync(file, edit);
  assert.equal((await go({ token: t3.token })).data.code, 'HOST_BACKUP_COPY_CHANGED', 'the file changed after it was tested'); fs.writeFileSync(file, good);
  assert.ok(readJsonl(srv.logDir, 'host').some(e => e.event === 'backup.restore' && e.level === 'warn' && /refused/.test(e.message)), 'a refused restore is audited');
});

test('damaged, wrong passphrase, integrity failure, newer app and unreachable destination each fail a check and give no token', { skip: !sqlite && 'SQLite-only', timeout: 120000 }, async () => {
  const name = offsiteName(), good = fs.readFileSync(path.join(davDir(), name));
  // damaged: one byte changed, same size
  const bad = Buffer.from(good); bad[Math.floor(bad.length / 2)] ^= 0xff; fs.writeFileSync(path.join(davDir(), 'myboxstock-offsite-2026-01-01-00-00-01.db.mbsenc'), bad);
  let r = (await testCopy('myboxstock-offsite-2026-01-01-00-00-01.db.mbsenc')).data; assert.equal(r.ok, false); assert.equal(r.token, null); assert.match(r.summary, /did not pass/); assert.match(JSON.stringify(r.checks), /Wrong passphrase|does not open this copy|damaged/i);
  // truncated: the destination size does not match what arrives only for real cuts; a shortened file fails decryption
  fs.writeFileSync(path.join(davDir(), 'myboxstock-offsite-2026-01-01-00-00-02.db.mbsenc'), good.subarray(0, good.length - 30));
  r = (await testCopy('myboxstock-offsite-2026-01-01-00-00-02.db.mbsenc')).data; assert.equal(r.ok, false); assert.equal(r.token, null);
  // wrong passphrase typed in the sheet, then the right one
  r = (await testCopy(name, { passphrase: 'not the right passphrase' })).data; assert.equal(r.ok, false); assert.match(JSON.stringify(r.checks), /old passphrase/); assert.equal(r.token, null);
  r = (await testCopy(name, { passphrase: PASS })).data; assert.equal(r.ok, true, 'typing the right passphrase works too');
  // a passphrase that was changed since: copy encrypted with another passphrase fails with the plain hint
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-mk-')), snap = path.join(tmp, 's.db');
  try {
    const live = fs.readdirSync(path.join(srv.dir, 'backup')).find(f => /^myboxstock-snap-.*\.db$/.test(f)); fs.copyFileSync(path.join(srv.dir, 'backup', live), snap);
    await encryptFile(snap, path.join(davDir(), 'myboxstock-offsite-2026-01-02-00-00-00.db.mbsenc'), 'some earlier passphrase');
    r = (await testCopy('myboxstock-offsite-2026-01-02-00-00-00.db.mbsenc')).data; assert.equal(r.ok, false); assert.match(JSON.stringify(r.checks), /passphrase was changed/);
    // integrity failure: a real database with damaged pages, encrypted correctly, so the copy decrypts but the database check fails
    const dmg = Buffer.from(fs.readFileSync(snap)); assert.ok(dmg.length > 20000, 'a database large enough to damage'); for (let o = 8192; o < Math.min(dmg.length, 40000); o += 7) dmg[o] = (dmg[o] * 31 + 7) & 0xff;
    fs.writeFileSync(snap, dmg); await encryptFile(snap, path.join(davDir(), 'myboxstock-offsite-2026-01-03-00-00-00.db.mbsenc'), PASS);
    r = (await testCopy('myboxstock-offsite-2026-01-03-00-00-00.db.mbsenc')).data; assert.equal(r.ok, false); assert.equal(r.token, null); assert.match(JSON.stringify(r.checks), /integrity check|damaged|not a SQLite/i); assert.ok(r.checks.some(c => c.ok && /opens the copy/.test(c.label)), 'it did decrypt');
    // newer app: the database has a migration this server does not know
    fs.copyFileSync(path.join(srv.dir, 'backup', live), snap); const nd = new DatabaseSync(snap); nd.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (9999, 1)').run(); nd.close();
    await encryptFile(snap, path.join(davDir(), 'myboxstock-offsite-2026-01-04-00-00-00.db.mbsenc'), PASS);
    r = (await testCopy('myboxstock-offsite-2026-01-04-00-00-00.db.mbsenc')).data; assert.equal(r.ok, false); assert.match(JSON.stringify(r.checks), /newer version of myBoxStock/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  // unreachable destination
  const id = await destId(); tweakDest(srv.dir, id, (x) => { x.settings.url = 'http://127.0.0.1:9/dav'; });
  try { r = (await testCopy(name)).data; assert.equal(r.ok, false); assert.equal(r.token, null); assert.match(r.checks[0].label, /destination can be reached/); assert.match(r.summary, /Could not reach/); }
  finally { tweakDest(srv.dir, id, (x) => { x.settings.url = dav.url; }); }
  assert.equal((await host.req('POST', `${API}/offsite/test`, { destination: id, name: '../etc/passwd' })).status, 404);
  assert.ok(!fs.readdirSync(os.tmpdir()).some(f => f.startsWith('mbs-offtest-')), 'no scratch copy is left behind');
  for (const n of fs.readdirSync(davDir()).filter(f => /2026-01-0/.test(f))) fs.rmSync(path.join(davDir(), n));
});

test('restore from a tested offsite copy: safety copy first, site restarts on the old data, the notice is posted, and the restore can be undone from the Safety copies', { skip: !sqlite && 'SQLite-only', timeout: 170000 }, async () => {
  const name = offsiteName(), dest = await destId();
  const late = new Client(srv.base), r0 = await late.req('POST', '/api/app/signup', { businessName: 'Late Boxes', email: 'l@example.com', username: 'lee', password: PW }); assert.equal(r0.status, 200, JSON.stringify(r0.data));
  const lateLogin = r0.data.login, canLate = async (base) => (await new Client(base).req('POST', '/api/app/login', { login: lateLogin, password: PW })).status === 200;
  assert.equal(await canLate(srv.base), true);
  const t = (await testCopy(name)).data; assert.equal(t.ok, true); assert.equal(t.compare.relation, 'older'); assert.equal(t.compare.accountsOnlyLive, 1);
  const res = await host.req('POST', `${API}/offsite/restore`, { destination: dest, name, token: t.token, confirm: 'RESTORE' }); assert.equal(res.status, 200, JSON.stringify(res.data)); assert.equal(res.data.restarting, true);
  assert.match(res.data.safetyCopy, /^myboxstock-pre-restore-.*\.db$/); assert.ok(fs.existsSync(path.join(srv.dir, 'backup', res.data.safetyCopy)), 'the safety copy exists');
  await new Promise(r => srv.proc.once('exit', r));
  const b = await startServer({ DATA_DIR: srv.dir }), h2 = await login(b.base);
  try {
    assert.equal(await canLate(b.base), false, 'the account made after the copy is gone');
    const a = (await h2.req('GET', '/api/host/settings')).data.announcement; assert.equal(a.enabled, true); assert.match(a.text, /The site was restored from a backup taken/);
    const safe = (await h2.req('GET', `${API}/files?tier=safety`)).data.rows; assert.ok(safe.some(x => x.name === res.data.safetyCopy), 'it is listed on the Safety copies tab');
    const host_ = readJsonl(srv.logDir, 'host'); assert.ok(host_.some(e => e.event === 'backup.restore' && e.actor === 'admin' && e.level === 'warn' && /offsite copy/.test(e.message) && e.data?.safetyCopy === res.data.safetyCopy), 'backup.restore is audited in the log (the restored database is the older one)'); assert.ok(host_.some(e => e.event === 'backup.test_restore' && /offsite/.test(e.message)));
    // undo: restore the safety copy through the normal restore
    assert.equal((await h2.req('POST', `${API}/${res.data.safetyCopy}/restore`, { confirm: 'RESTORE' })).status, 200);
    await new Promise(r => b.proc.once('exit', r));
    const c = await startServer({ DATA_DIR: srv.dir });
    try { assert.equal(await canLate(c.base), true, 'undo brought the later account back'); } finally { c.stop(); }
  } finally { b.stop(); srv = null; }
});
