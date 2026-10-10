// TEST / t48-host-backup — Host full-site backup and restore with Demo mode accounts: left out by default (full-site .mbsbak and the offsite copy), put in when the option says so,
// the live site untouched, the restored site holds every real account and record, and "Test a backup file" reports the new record kinds (models, settings records) and the demo
// accounts it left out or holds. Counts only: nothing is decrypted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, ROOT, sleep } from './helpers.mjs';
import { davSim } from './helpers-backup-sims.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase', API = '/api/host/backups', FT = `${API}/file-test`;
let srv, host, dav; const codes = {};
const raw = (dir = srv.dir) => { const d = new DatabaseSync(path.join(dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); return d; };
const add = (id, type, n) => { const d = raw(); try { for (let i = 0; i < n; i++) d.prepare('INSERT INTO records (id, account_id, type, blob, rev, created_at, updated_at) VALUES (?,?,?,?,1,?,?)').run(crypto.randomUUID(), id, type, 'BLOB', Date.now(), Date.now()); } finally { d.close(); } };
const idOf = (code) => { const d = raw(); try { return d.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code).id; } finally { d.close(); } };
const run = (source) => host.req('POST', `${FT}/run`, { source, passphrase: PASS });
const makeBundle = async () => { const r = await host.req('POST', `${API}/bundle`, { passphrase: PASS }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.name; };

test.before(async () => {
  if (!sqlite) return;
  srv = await startServer(); host = new Client(srv.base); dav = await davSim(); dav.init();
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  for (const [bn, un] of [['Real One', 'ron'], ['Real Two', 'rae'], ['Demo Three', 'dee']]) { const r = await new Client(srv.base).req('POST', '/api/app/signup', { businessName: bn, email: `${un}@example.com`, username: un, password: PW }); assert.equal(r.status, 200, JSON.stringify(r.data)); codes[bn] = r.data.login.split('@')[1]; }
  const [one, two, dem] = ['Real One', 'Real Two', 'Demo Three'].map(n => idOf(codes[n]));
  for (const id of [one, two, dem]) { add(id, 'item', 3); add(id, 'customer', 2); add(id, 'sale', 2); add(id, 'model', 1); add(id, 'config', 1); }
  const d = raw(); try { // Demo Three is a demo account with a login row, as Build leaves it
    d.prepare("UPDATE accounts SET demo = 1, demo_set = 'demo3' WHERE id = ?").run(dem);
    const u = d.prepare('SELECT id FROM account_users WHERE account_id = ?').get(dem);
    d.prepare("INSERT INTO demo_logins (user_id, account_id, set_key, kind, login, role, pw_sealed, created_at) VALUES (?,?,?,?,?,?,?,?)").run(u.id, dem, 'demo3', 'owner', `dee@${codes['Demo Three']}`, 'Administrator', 'SEALED-DEMO-PASSWORD', Date.now());
  } finally { d.close(); }
});
test.after(() => { srv?.stop(); dav?.close(); });

test('a full-site backup leaves demo accounts out, keeps every real account, and the live site is untouched', { skip: !sqlite && 'SQLite-only' }, async () => {
  const name = await makeBundle(); fs.copyFileSync(path.join(srv.dir, 'backup', name), path.join(srv.dir, 'backup', 'without-demo.mbsbak'));
  const r = (await run({ folder: 'without-demo.mbsbak' })).data; assert.equal(r.ok, true, JSON.stringify(r.checks));
  assert.equal(r.report.accounts.total, 2, 'only the two real accounts are in the file'); assert.equal(r.details.demoLeftOut, 1); assert.equal(r.report.demo.inFile, 0);
  assert.deepEqual(r.report.rows.map(x => x[0]).sort(), [codes['Real One'], codes['Real Two']].sort());
  assert.deepEqual(r.report.records.file, { devices: 6, customers: 4, sales: 4, other: 4 }, 'devices, customers, sales and the rest');
  assert.deepEqual(r.report.kinds.file, { models: 2, settings: 2, other: 0 }, 'models and settings records are counted by kind');
  assert.deepEqual(r.report.kinds.live, { models: 3, settings: 3, other: 0 }, 'the live site still has the demo account\'s records');
  assert.equal(r.report.live.accounts, 3); assert.equal(r.report.compare.onlyLiveTotal, 1, 'the demo account shows as only on the live site'); assert.equal(r.report.compare.onlyLive[0].code, codes['Demo Three']);
  const d = raw(); try { assert.equal(d.prepare('SELECT COUNT(*) n FROM accounts WHERE demo = 1').get().n, 1); assert.equal(d.prepare('SELECT COUNT(*) n FROM demo_logins').get().n, 1); assert.equal(d.prepare('SELECT COUNT(*) n FROM records WHERE account_id = ?').get(idOf(codes['Demo Three'])).n, 9); } finally { d.close(); }
  assert.ok(!JSON.stringify(r).includes('SEALED-DEMO-PASSWORD') && !JSON.stringify(r).includes('BLOB'), 'no demo password and no record content in a report');
});

test('restoring that backup on a clean server brings back the real accounts and records, and no demo accounts or logins', { skip: !sqlite && 'SQLite-only restore path' }, async () => {
  const file = path.join(srv.dir, 'backup', 'without-demo.mbsbak'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-t48-fresh-'));
  const out = spawnSync('node', ['server.mjs', 'restore-bundle', '--file', file], { cwd: ROOT, env: { ...process.env, DATA_DIR: dir, BACKUP_PASSPHRASE: PASS }, encoding: 'utf8' }); assert.equal(out.status, 0, out.stderr);
  const b = await startServer({ DATA_DIR: dir });
  try {
    const h = new Client(b.base); assert.equal((await h.req('POST', '/api/host/login', { login: 'admin', password: PW })).status, 200, 'the Host administrator signs in with the same password');
    const list = JSON.stringify((await h.req('GET', '/api/host/accounts')).data); assert.ok(list.includes(codes['Real One']) && list.includes(codes['Real Two']) && !list.includes(codes['Demo Three']), 'real accounts are back, the demo one is not');
    const d = raw(dir); try {
      assert.equal(d.prepare('SELECT COUNT(*) n FROM accounts').get().n, 2); assert.equal(d.prepare('SELECT COUNT(*) n FROM accounts WHERE demo = 1').get().n, 0); assert.equal(d.prepare('SELECT COUNT(*) n FROM demo_logins').get().n, 0);
      for (const n of ['Real One', 'Real Two']) assert.deepEqual(d.prepare('SELECT type, COUNT(*) n FROM records WHERE account_id = ? GROUP BY type ORDER BY type').all(idOf(codes[n])).map(x => [x.type, x.n]), [['config', 1], ['customer', 2], ['item', 3], ['model', 1], ['sale', 2]]);
      assert.equal(d.prepare('SELECT COUNT(*) n FROM records WHERE account_id NOT IN (SELECT id FROM accounts)').get().n, 0, 'no orphan records of the left-out account');
      assert.equal(d.prepare('SELECT COUNT(*) n FROM account_users WHERE account_id NOT IN (SELECT id FROM accounts)').get().n, 0);
    } finally { d.close(); }
    const app = new Client(b.base); assert.equal((await app.req('POST', '/api/app/login', { login: `ron@${codes['Real One']}`, password: PW })).status, 200, 'a real reseller signs in on the restored site');
  } finally { await sleep(500); b.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('with "Leave demo accounts out of backups" switched off the demo accounts are in the file, and the test says so', { skip: !sqlite && 'SQLite-only' }, async () => {
  const put = await host.req('PUT', '/api/host/demo/options', { backupMaxAgeHours: 24, excludeFromBackups: false, usePlanCeiling: false }); assert.equal(put.status, 200, JSON.stringify(put.data));
  const name = await makeBundle(); fs.copyFileSync(path.join(srv.dir, 'backup', name), path.join(srv.dir, 'backup', 'with-demo.mbsbak'));
  const r = (await run({ folder: 'with-demo.mbsbak' })).data; assert.equal(r.ok, true, JSON.stringify(r.checks));
  assert.equal(r.report.accounts.total, 3); assert.equal(r.details.demoLeftOut, 0); assert.equal(r.report.demo.inFile, 1); assert.deepEqual(r.report.kinds.file, { models: 3, settings: 3, other: 0 });
  assert.equal(r.report.compare.onlyLiveTotal, 0);
  await host.req('PUT', '/api/host/demo/options', { backupMaxAgeHours: 24, excludeFromBackups: true, usePlanCeiling: false });
});

test('the offsite copy leaves demo accounts out too, and an older file (no demo column) is still tested', { skip: !sqlite && 'SQLite-only' }, async () => {
  assert.equal((await host.req('PUT', `${API}/full`, { enabled: false, passphrase: PASS, keepDaily: 14, keepWeekly: 8 })).status, 200);
  const made = await host.req('POST', `${API}/destinations`, { type: 'webdav', name: 'Office DAV', enabled: false, settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: { password: dav.pass } }); assert.equal(made.status, 200, JSON.stringify(made.data));
  assert.equal((await host.req('POST', `${API}/destinations/${made.data.id}/test`)).data.ok, true);
  assert.equal((await host.req('PUT', `${API}/destinations/${made.data.id}`, { name: 'Office DAV', enabled: true, settings: { url: dav.url, username: dav.user, folder: 'mbs' }, secrets: {} })).status, 200);
  assert.equal((await host.req('PUT', `${API}/tiers`, { offsite: { enabled: true, everyMinutes: 60, destinations: [made.data.id] } })).status, 200);
  const r = await host.req('POST', `${API}/run/offsite`); assert.equal(r.status, 200, JSON.stringify(r.data));
  const remote = fs.readdirSync(path.join(dav.root, 'dav', 'mbs')).find(f => f.endsWith('.db.mbsenc')); assert.ok(remote);
  fs.copyFileSync(path.join(dav.root, 'dav', 'mbs', remote), path.join(srv.dir, 'backup', 'myboxstock-offsite-copy.db.mbsenc'));
  const t = (await run({ folder: 'myboxstock-offsite-copy.db.mbsenc' })).data; assert.equal(t.ok, true, JSON.stringify(t.checks));
  assert.equal(t.report.accounts.total, 2, 'the offsite copy holds the real accounts only'); assert.equal(t.report.demo.inFile, 0); assert.ok(!t.report.rows.some(x => x[0] === codes['Demo Three']));
  // a snapshot (.db) is a whole copy of the database: it still holds the demo account, and the test shows that plainly
  const snap = (await host.req('POST', `${API}/run/frequent`)).data.name || fs.readdirSync(path.join(srv.dir, 'backup')).find(f => /^myboxstock-snap-.*\.db$/.test(f));
  const s = (await run({ folder: snap })).data; assert.equal(s.ok, true, JSON.stringify(s.checks)); assert.equal(s.report.accounts.total, 3); assert.equal(s.report.demo.inFile, 1);
  // a copy made before Demo mode existed has no demo column: it reports no demo accounts and no error
  const old = path.join(srv.dir, 'backup', 'myboxstock-snap-v24.db'); fs.copyFileSync(path.join(srv.dir, 'backup', snap), old);
  const d = new DatabaseSync(old); try { d.exec('DROP INDEX idx_accounts_demo; ALTER TABLE accounts DROP COLUMN demo; ALTER TABLE accounts DROP COLUMN demo_set; DROP TABLE demo_logins; VACUUM'); } finally { d.close(); }
  const o = (await run({ folder: 'myboxstock-snap-v24.db' })).data; assert.equal(o.report.demo.inFile, 0); assert.equal(o.report.accounts.total, 3); assert.equal(o.report.rows.length, 3);
});

test('the Host page for Test a backup file shows the new kinds and the demo note', { skip: !sqlite && 'SQLite-only' }, async () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/host/views/backups-filetest.js'), 'utf8');
  for (const t of ['Models (reorder levels)', 'Settings records', 'ft-demoleft', 'ft-demoin']) assert.ok(src.includes(t), `the page shows ${t}`);
});
