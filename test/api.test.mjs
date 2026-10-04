import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { totpCode } from '../src/auth/totp.mjs';
import { enableVault, putRecord, readRecords, addUser, Vault } from './vault-helper.mjs';
import { startServer, Client, ROOT } from './helpers.mjs';

let srv, dir, host, alice, bob;
test.before(async () => { srv = await startServer(); dir = srv.dir; host = new Client(srv.base); alice = new Client(srv.base); bob = new Client(srv.base); });
test.after(() => srv?.stop());

const mk = () => new Client(srv.base);
const STRONG = 'Sup3rSecretPass!';


test('host admin: forced password change, then TOTP required at sign-in', async () => {
  let r = await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); assert.equal(r.status, 200); assert.equal(r.data.mustChange, true);
  r = await host.req('GET', '/api/host/dashboard'); assert.equal(r.status, 403); // blocked until password changed
  r = await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: STRONG }); assert.equal(r.status, 200);
  r = await host.req('POST', '/api/host/totp/setup'); assert.equal(r.status, 200);
  const secret = r.data.secret;
  r = await host.req('POST', '/api/host/totp/enable', { code: '000000' }); assert.equal(r.status, 400);
  r = await host.req('POST', '/api/host/totp/enable', { code: totpCode(secret) }); assert.equal(r.status, 200); assert.equal(r.data.recoveryCodes.length, 8);
  await host.req('POST', '/api/host/logout');
  const h2 = mk();
  r = await h2.req('POST', '/api/host/login', { login: 'admin', password: STRONG }); assert.equal(r.data.mfa, true);
  r = await h2.req('GET', '/api/host/dashboard'); assert.equal(r.status, 401); // MFA pending = no access
  r = await h2.req('POST', '/api/host/login/mfa', { code: '111111' }); assert.equal(r.status, 401);
  r = await h2.req('POST', '/api/host/login/mfa', { code: totpCode(secret) }); assert.equal(r.status, 200);
  r = await h2.req('GET', '/api/host/dashboard'); assert.equal(r.status, 200); assert.ok(r.data.memory.total > 0);
  Object.assign(host, h2); host.secret = secret;
});

test('accounts sign up with unique IDs; CSRF is enforced', async () => {
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1, hostConsoleAllowOnly: false });
  let r = await alice.req('POST', '/api/app/signup', { businessName: 'Alice Boxes', email: 'alice@example.com', username: 'alice', password: STRONG }); assert.equal(r.status, 200);
  assert.match(r.data.accountCode, /^[a-z]+-[a-z]+-\d{4}$/); assert.match(r.data.login, /^alice@[a-z]+-[a-z]+-\d{4}$/);
  alice.login = r.data.login; alice.code = r.data.accountCode;
  r = await bob.req('POST', '/api/app/signup', { businessName: 'Bob Streams', email: 'bob@example.com', username: 'alice', password: STRONG }); assert.equal(r.status, 200);
  assert.notEqual(r.data.accountCode, alice.code); bob.login = r.data.login; // same username, different account = fine
  r = await alice.req('POST', '/api/app/login', { login: alice.login, password: STRONG }); assert.equal(r.status, 200);
  r = await alice.req('POST', '/api/app/vault/batch', { puts: [] }, { csrf: false }); assert.equal(r.status, 403);
  r = await bob.req('POST', '/api/app/login', { login: bob.login, password: STRONG }); assert.equal(r.status, 200);
});

test('tenant isolation: accounts cannot see each other, host cannot see data', async () => {
  alice.adk = (await enableVault(alice, STRONG)).adk; bob.adk = (await enableVault(bob, STRONG)).adk;
  let r = await putRecord(alice, alice.adk, 'item', { uid: 'ALICE-SECRET-UID', model: 'V6' }); assert.equal(r.status, 200);
  r = await putRecord(bob, bob.adk, 'item', { uid: 'BOB-UID' }); assert.equal(r.status, 200);
  assert.deepEqual((await readRecords(alice, alice.adk)).items.map(x => x.data.uid), ['ALICE-SECRET-UID']);
  assert.deepEqual((await readRecords(bob, bob.adk)).items.map(x => x.data.uid), ['BOB-UID']);
  // host console: sweep every endpoint that returns data and make sure no tenant business data leaks
  const blob = [];
  for (const p of ['/dashboard', '/accounts', '/audit', '/backups', '/mail', '/firewall', '/settings']) blob.push(JSON.stringify((await host.req('GET', '/api/host' + p)).data));
  const accts = (await host.req('GET', '/api/host/accounts')).data; assert.equal(accts.length, 2);
  for (const a of accts) blob.push(JSON.stringify((await host.req('GET', `/api/host/accounts/${a.id}`)).data));
  assert.ok(!blob.join('').includes('ALICE-SECRET-UID')); assert.ok(!blob.join('').includes('BOB-UID'));
  // realms are separate
  r = await alice.req('GET', '/api/host/dashboard'); assert.equal(r.status, 401);
  const stolen = mk(); stolen.jar = { mbs_host: host.jar.mbs_host }; stolen.csrf = host.csrf;
  r = await stolen.req('GET', '/api/app/vault/records'); assert.equal(r.status, 401); // host cookie is useless in the app realm
});

test('standard/view roles are limited; optional user MFA; host support actions', async () => {
  let r = await addUser(alice, alice.adk, { username: 'viewer', role: 'View', password: 'Viewer-pass-123' }); assert.equal(r.status, 200);
  const v = mk(); r = await v.req('POST', '/api/app/login', { login: r.data.login, password: 'Viewer-pass-123' }); assert.equal(r.data.mustChange, true);
  r = await v.req('POST', '/api/app/change-password', { current: 'Viewer-pass-123', next: 'Viewer-pass-456', keys: await Vault.keysFor('Viewer-pass-456', alice.adk) }); assert.equal(r.status, 200);
  r = await v.req('POST', '/api/app/vault/batch', { puts: [{ id: 'abcdefgh1', type: 'item', rev: 0, blob: 'v1.AAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA' }] }); assert.equal(r.status, 403);
  r = await v.req('GET', '/api/app/users'); assert.equal(r.status, 403);
  r = await v.req('GET', '/api/app/vault/records'); assert.equal(r.status, 200);
  // viewer enables 2FA, host resets it
  r = await v.req('POST', '/api/app/totp/setup'); const secret = r.data.secret;
  r = await v.req('POST', '/api/app/totp/enable', { code: totpCode(secret) }); assert.equal(r.status, 200);
  const acct = (await host.req('GET', '/api/host/accounts')).data.find(a => a.account_code === alice.code);
  const detail = (await host.req('GET', `/api/host/accounts/${acct.id}`)).data; const vu = detail.users.find(u => u.username === 'viewer'); assert.equal(!!vu.totp_enabled, true);
  r = await host.req('POST', `/api/host/accounts/${acct.id}/users/${vu.id}/reset-mfa`, { reason: 'test reset' }); assert.equal(r.status, 200);
  r = await v.req('GET', '/api/app/vault/records'); assert.equal(r.status, 401); // signed out by reset
  r = await host.req('POST', `/api/host/accounts/${acct.id}/users/${vu.id}/temp-password`, { reason: 'test temp' }); assert.equal(r.status, 200);
  const v2 = mk(); r = await v2.req('POST', '/api/app/login', { login: vu.login, password: r.data.tempPassword }); assert.equal(r.data.mustChange, true); assert.equal(r.data.mfa, false);
  // suspending blocks sign-in
  await host.req('POST', `/api/host/accounts/${acct.id}/status`, { status: 'suspended', reason: 'test suspend' });
  r = await mk().req('POST', '/api/app/login', { login: alice.login, password: STRONG }); assert.equal(r.status, 403); assert.equal(r.data.code, 'ACCOUNT_SUSPENDED'); assert.match(r.data.error, /suspended/);
  r = await mk().req('POST', '/api/app/login', { login: alice.login, password: 'Wrong-password-123' }); assert.equal(r.status, 401); assert.equal(r.data.code, 'LOGIN_INVALID'); // a wrong password never reveals the status
  await host.req('POST', `/api/host/accounts/${acct.id}/status`, { status: 'active', reason: 'test reactivate' });
});

test('backup + migrate-db copy the platform data', async () => {
  let r = await host.req('POST', '/api/host/backups'); assert.equal(r.status, 200); assert.match(r.data.name, /\.(db|sql)$/);
  r = await host.req('GET', '/api/host/backups'); assert.equal(r.data.backups.length, 1);
  const target = path.join(dir, 'copy.db');
  execFileSync('node', ['server.mjs', 'migrate-db', '--to', 'sqlite:' + target], { cwd: ROOT, env: { ...process.env, ...srv.env, DATA_DIR: dir, PORT: '1', LOG_CONSOLE: '0' }, stdio: 'pipe' });
  const { DatabaseSync } = await import('node:sqlite'); const d = new DatabaseSync(target);
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 2); assert.equal(d.prepare('SELECT COUNT(*) AS n FROM records').get().n, 2); d.close();
});

test('firewall: deny rule blocks, lockout protection, auth rate limit', async () => {
  let r = await host.req('POST', '/api/host/firewall/rules', { kind: 'deny', cidr: '127.0.0.1' }); assert.equal(r.status, 400); // would lock out self
  r = await host.req('POST', '/api/host/firewall/rules', { kind: 'deny', cidr: 'not-an-ip' }); assert.equal(r.status, 400);
  r = await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 1000, windowSec: 60, authMaxAttempts: 3, authWindowSec: 10, banAfterViolations: 50, banMinutes: 1, hostConsoleAllowOnly: true });
  assert.equal(r.status, 400); // no allow rule for my address yet
  r = await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 1000, windowSec: 60, authMaxAttempts: 3, authWindowSec: 10, banAfterViolations: 50, banMinutes: 1, hostConsoleAllowOnly: false });
  assert.equal(r.status, 200);
  await new Promise(r => setTimeout(r, 10500)); // let earlier sign-ins age out of the 10s window
  const c = mk(); const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await c.req('POST', '/api/app/login', { login: 'nobody@bx-zzzzzz', password: 'wrong-password-1' })).status);
  assert.deepEqual(codes, [401, 401, 401, 429, 429]);
});
