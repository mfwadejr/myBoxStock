// TEST / auto-backup — scheduled full-site backups: settings rules, run + verify, off-box copy, retention, failure alert, restore on a fresh folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startServer, Client, ROOT, sleep } from './helpers.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase';
let srv, host, off;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base); off = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-off-'));
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Kept Boxes', email: 'k@example.com', username: 'kim', password: PW });
});
test.after(() => { srv?.stop(); fs.rmSync(off, { recursive: true, force: true }); });
const save = (o) => host.req('PUT', '/api/host/backups/full', { enabled: true, frequency: 'nightly', hourUtc: 3, weekday: 0, keepDaily: 14, keepWeekly: 8, offboxDir: '', ...o });
const files = (dir, tag) => fs.readdirSync(dir).filter(f => f.startsWith(`myboxstock-fullsite-${tag}-`));

test('settings: a passphrase is required, must be long enough, and the off-box folder must be a full path', async () => {
  assert.equal((await save({})).status, 400, 'cannot turn on without a passphrase');
  assert.equal((await save({ passphrase: 'short' })).status, 400);
  assert.equal((await save({ passphrase: PASS, offboxDir: 'relative/dir' })).status, 400);
  assert.equal((await save({ passphrase: PASS, offboxDir: off })).status, 200);
  const g = (await host.req('GET', '/api/host/backups')).data;
  assert.equal(g.full.hasPassphrase, true); assert.equal(JSON.stringify(g).includes(PASS), false, 'the passphrase is never sent back');
  assert.equal(JSON.stringify(g).includes('passphrase":"'), false);
});

test('run now: a verified backup is written, copied off-box, and shown as the last good backup', { skip: !sqlite && 'verification opens the SQLite file' }, async () => {
  const r = await host.req('POST', '/api/host/backups/full/run'); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.verified, true); assert.equal(r.data.offbox, off); assert.ok(r.data.accounts >= 1);
  assert.equal(files(path.join(srv.dir, 'backup'), 'daily').length, 1); assert.equal(files(off, 'daily').length, 1);
  const st = (await host.req('GET', '/api/host/dashboard')).data.backup; assert.equal(st.status.lastOk.name, r.data.name); assert.equal(st.full.enabled, true);
  const log = fs.readFileSync(path.join(srv.logDir, 'backup', 'backup.log'), 'utf8'); assert.match(log, /done and verified/); assert.ok(!log.includes(PASS), 'the passphrase is never logged');
});

test('retention keeps only the newest daily copies, here and off-box', { skip: !sqlite && 'verification opens the SQLite file' }, async () => {
  await save({ keepDaily: 2, offboxDir: off });
  for (let i = 0; i < 3; i++) { await sleep(1100); assert.equal((await host.req('POST', '/api/host/backups/full/run')).status, 200); }
  assert.equal(files(path.join(srv.dir, 'backup'), 'daily').length, 2); assert.equal(files(off, 'daily').length, 2);
});

test('restore: a scheduled backup from the off-box folder brings the site back on a fresh data folder', { skip: !sqlite && 'SQLite-only restore path' }, async () => {
  const newest = files(off, 'daily').sort().at(-1), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-fresh-'));
  const out = spawnSync('node', ['server.mjs', 'restore-bundle', '--file', path.join(off, newest)], { cwd: ROOT, env: { ...process.env, DATA_DIR: dir, BACKUP_PASSPHRASE: PASS }, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const b = await startServer({ DATA_DIR: dir }), c = new Client(b.base);
  assert.equal((await c.req('POST', '/api/host/login', { login: 'admin', password: PW })).status, 200, 'the Host administrator signs in with the same password');
  assert.ok((await c.req('GET', '/api/host/accounts')).data.accounts?.length >= 1 || JSON.stringify((await c.req('GET', '/api/host/accounts')).data).includes('Kept Boxes'), 'the account is back');
  b.stop();
});

test('failure: an unusable off-box folder is recorded, logged and emailed; the dashboard shows it', { skip: !sqlite && 'edits the database file' }, async () => {
  const { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.prepare("UPDATE host_admins SET email = 'ops@example.com'").run(); d.close();
  const blocker = path.join(off, 'a-file'); fs.writeFileSync(blocker, 'x');
  await save({ offboxDir: path.join(blocker, 'sub') });
  const r = await host.req('POST', '/api/host/backups/full/run'); assert.equal(r.status, 400);
  const st = (await host.req('GET', '/api/host/dashboard')).data.backup.status; assert.ok(st.lastFail.at >= st.lastOk.at, 'the failure is the latest event'); assert.ok(st.lastFail.error);
  assert.match(JSON.stringify((await host.req('GET', '/api/host/mail')).data.queue), /scheduled backup did not complete/);
  assert.match(fs.readFileSync(path.join(srv.logDir, 'backup', 'backup.log'), 'utf8'), /Scheduled full-site backup failed/);
});
