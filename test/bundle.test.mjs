// TEST / bundle — the full-site backup restores onto an empty server and everyone signs in as if nothing happened.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startServer, Client, ROOT } from './helpers.mjs';
import { totpCode } from '../src/auth/totp.mjs';
import { sealBundle, openBundle } from '../src/services/backup/bundle.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase';

test('bundle files are encrypted, detect a wrong passphrase and damage', () => {
  const f = sealBundle([['manifest.json', Buffer.from('{"x":1}')], ['secret.key', Buffer.from('KEY')]], PASS);
  assert.ok(!f.includes(Buffer.from('KEY')) && !f.includes(Buffer.from('"x"')));
  assert.equal(openBundle(f, PASS)['secret.key'].toString(), 'KEY');
  assert.throws(() => openBundle(f, 'not the passphrase!!'), /Wrong passphrase/);
  const bad = Buffer.from(f); bad[bad.length - 30] ^= 1; assert.throws(() => openBundle(bad, PASS), /Wrong passphrase|damaged/);
  assert.throws(() => openBundle(Buffer.from('hello world, not a backup at all'), PASS), /not a myBoxStock/);
});

test('full-site backup restores on an empty server: password and two-factor sign-in still work', { skip: !sqlite && 'SQLite-only restore path' }, async () => {
  const a = await startServer(); const host = new Client(a.base), user = new Client(a.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: a.hostPw }); await host.req('POST', '/api/host/change-password', { current: a.hostPw, next: PW });
  let r = await user.req('POST', '/api/app/signup', { businessName: 'Survivor Boxes', email: 's@example.com', username: 'sam', password: PW }); const login = r.data.login;
  await user.req('POST', '/api/app/login', { login, password: PW });
  r = await user.req('POST', '/api/app/totp/setup'); const secret = r.data.secret; await user.req('POST', '/api/app/totp/enable', { code: totpCode(secret) });
  assert.equal((await host.req('POST', '/api/host/backups/bundle', { passphrase: 'short' })).status, 400);
  r = await host.req('POST', '/api/host/backups/bundle', { passphrase: PASS }); assert.equal(r.status, 200); assert.match(r.data.name, /\.mbsbak$/);
  assert.equal((await host.req('GET', '/api/host/backups')).data.backups.find(b => b.name === r.data.name).kind, 'fullsite');
  const copy = path.join(os.tmpdir(), 'mbs-test-' + Date.now() + '.mbsbak'); fs.copyFileSync(path.join(a.dir, 'backup', r.data.name), copy);
  assert.ok(!fs.readFileSync(copy).includes(Buffer.from('SQLite format')), 'the database is not readable inside the file');
  a.stop();

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-new-'));
  const cli = (extra, pass = PASS) => spawnSync('node', ['server.mjs', 'restore-bundle', '--file', copy, ...extra], { cwd: ROOT, env: { ...process.env, DATA_DIR: dir, BACKUP_PASSPHRASE: pass }, encoding: 'utf8' });
  assert.notEqual(cli([], 'wrong passphrase here').status, 0);
  let out = cli([]); assert.equal(out.status, 0, out.stderr); assert.match(out.stdout, /Restored a sqlite backup/);
  assert.notEqual(cli([]).status, 0, 'refuses to overwrite existing data without --force');

  const b = await startServer({ DATA_DIR: dir }); const again = new Client(b.base);
  r = await again.req('POST', '/api/app/login', { login, password: PW }); assert.equal(r.status, 200); assert.equal(r.data.mfa, true, 'two-factor still required');
  r = await again.req('POST', '/api/app/login/mfa', { code: totpCode(secret) }); assert.equal(r.status, 200, 'the TOTP secret was decrypted with the restored key');
  assert.equal((await again.req('GET', '/api/app/me')).data.user.businessName, 'Survivor Boxes');
  b.stop(); fs.rmSync(copy, { force: true });
});

test('console restore of a full-site backup replaces the database and key after a restart', { skip: !sqlite && 'SQLite-only restore path' }, async () => {
  const a = await startServer(); const host = new Client(a.base), u1 = new Client(a.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: a.hostPw }); await host.req('POST', '/api/host/change-password', { current: a.hostPw, next: PW });
  await u1.req('POST', '/api/app/signup', { businessName: 'Before', email: 'b@example.com', username: 'bea', password: PW });
  const name = (await host.req('POST', '/api/host/backups/bundle', { passphrase: PASS })).data.name;
  await host.req('PUT', '/api/host/settings', { trialDays: 9 });
  assert.equal((await host.req('GET', '/api/host/settings')).data.trialDays, 9);
  assert.equal((await host.req('POST', `/api/host/backups/${name}/restore-bundle`, { passphrase: 'wrong wrong wrong', confirm: 'RESTORE' })).status, 400);
  assert.equal((await host.req('POST', `/api/host/backups/${name}/restore-bundle`, { passphrase: PASS, confirm: 'RESTORE' })).status, 200);
  await new Promise(r => a.proc.once('exit', r));
  const b = await startServer({ DATA_DIR: a.dir }); const h2 = new Client(b.base);
  assert.equal((await h2.req('POST', '/api/host/login', { login: 'admin', password: PW })).status, 200);
  assert.equal((await h2.req('GET', '/api/host/accounts')).data.length, 1);
  assert.equal((await h2.req('GET', '/api/host/settings')).data.trialDays, 14, 'back to the state at backup time');
  assert.match((await h2.req('GET', '/api/host/settings')).data.announcement.text, /The site was restored from a backup taken .* UTC\. Sales or changes made after that time may be missing/, 'everyone is told after a full-site restore too');
  b.stop();
});
