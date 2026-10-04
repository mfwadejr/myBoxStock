// TEST / account-closing — close with password + Reseller ID, 7-day lock (restorable by the Administrator or a Host administrator),
// then automatic erase by the hourly job (sped up here), with emails at both ends.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let srv, host, d;
test.before(async () => {
  srv = await startServer({ CLOSING_SWEEP_MS: '400' }); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
  if (sqlite) { const { DatabaseSync } = await import('node:sqlite'); d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000'); }
});
test.after(() => srv?.stop());
const login = (id, username, password = PW) => { const c = new Client(srv.base); return c.req('POST', '/api/app/login', { resellerId: id, username, password }).then(r => ({ c, r })); };
async function mk(biz, email, user) { const r = (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: biz, email, username: user, password: PW })).data; const { c } = await login(r.resellerId, user); return { ...r, c }; }

test('close needs the password and the Reseller ID; locked for others, read-only for the Administrator; restore works', async () => {
  const a = await mk('Closing Co', 'close@example.com', 'carl');
  assert.equal((await a.c.req('POST', '/api/app/users', { username: 'staff1', email: '', role: 'Standard', password: 'Temp-pass-12345' })).status, 200);
  assert.equal((await a.c.req('POST', '/api/app/account/close', { password: 'wrong-password-1', resellerId: a.resellerId })).status, 400);
  assert.equal((await a.c.req('POST', '/api/app/account/close', { password: PW, resellerId: 'someone-else-1234' })).status, 400);
  const r = await a.c.req('POST', '/api/app/account/close', { password: PW, resellerId: a.resellerId.toUpperCase() }); assert.equal(r.status, 200);
  assert.ok(Math.abs(r.data.eraseAt - (Date.now() + 7 * 86400e3)) < 60e3, 'seven days');
  const staff = await login(a.resellerId, 'staff1', 'Temp-pass-12345'); assert.equal(staff.r.status, 403); assert.equal(staff.r.data.code, 'ACCOUNT_CLOSING');
  const admin = await login(a.resellerId, 'carl'); assert.equal(admin.r.status, 200);
  assert.ok((await admin.c.req('GET', '/api/app/me')).data.user.closingAt);
  const w = await admin.c.req('POST', '/api/app/users', { username: 'staff2', role: 'Standard', password: 'Temp-pass-12345' }); assert.equal(w.status, 423); assert.equal(w.data.code, 'ACCOUNT_CLOSING_LOCKED');
  assert.equal((await admin.c.req('GET', '/api/app/vault/records')).status !== 423, true, 'reading (and so exporting) still works');
  assert.equal((await admin.c.req('POST', '/api/app/account/restore')).status, 200);
  assert.equal((await admin.c.req('GET', '/api/app/me')).data.user.closingAt, null);
  assert.equal((await login(a.resellerId, 'staff1', 'Temp-pass-12345')).r.status, 200, 'everyone can sign in again');
});

test('a Standard user cannot close the account', async () => {
  const a = await mk('Nope Co', 'nope@example.com', 'nell'); await a.c.req('POST', '/api/app/users', { username: 'staff3', role: 'Standard', password: 'Temp-pass-12345' });
  const s = await login(a.resellerId, 'staff3', 'Temp-pass-12345');
  assert.equal((await s.c.req('POST', '/api/app/account/close', { password: 'Temp-pass-12345', resellerId: a.resellerId })).status, 403);
});

test('Host administrators see "closing", can restore, and the account is erased automatically after the period', { skip: !sqlite && 'SQLite-only (moves the date)' }, async () => {
  const a = await mk('Erase Co', 'erase@example.com', 'eddie'), b = await mk('Restore Co', 'restore@example.com', 'raelyn');
  for (const x of [a, b]) { const rr = await x.c.req('POST', '/api/app/account/close', { password: PW, resellerId: x.resellerId }); assert.equal(rr.status, 200, x.resellerId + ' ' + JSON.stringify(rr.data)); }
  const list = (await host.req('GET', '/api/host/accounts')).data; assert.ok(list.find(x => x.account_code === a.resellerId).closing_at);
  const idB = list.find(x => x.account_code === b.resellerId).id;
  assert.equal((await host.req('POST', `/api/host/accounts/${idB}/restore-closing`)).status, 200);
  assert.equal((await host.req('POST', `/api/host/accounts/${idB}/restore-closing`)).status, 400, 'nothing to restore any more');
  assert.equal((await b.c.req('GET', '/api/app/me')).data.user.closingAt, null);
  d.prepare('UPDATE accounts SET closing_at = ? WHERE account_code = ?').run(Date.now() - 1000, a.resellerId);
  for (let i = 0; i < 20 && (await host.req('GET', '/api/host/accounts')).data.some(x => x.account_code === a.resellerId); i++) await sleep(300);
  assert.equal((await host.req('GET', '/api/host/accounts')).data.some(x => x.account_code === a.resellerId), false, 'erased by the job');
  assert.equal((await login(a.resellerId, 'eddie')).r.status, 401);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM account_users WHERE username = 'eddie'").get().n, 0);
  const mails = d.prepare("SELECT subject FROM mail_queue WHERE to_addr = 'erase@example.com'").all().map(m => m.subject);
  assert.ok(mails.some(s => /is closing/.test(s)) && mails.some(s => /has been erased/.test(s)), 'emailed at the start and at the end');
});
