// TEST / host-unlock — a Host administrator can unlock a locked-out sign-in (Firewall page and account detail): sign-in works again, it is audited, the saved lockout is cleared, passwords are never shown, and only a signed-in Host administrator can do it.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let srv, host, d;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
  if (sqlite) { const { DatabaseSync } = await import('node:sqlite'); d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000'); }
});
test.after(() => srv?.stop());
const signin = (id, username, password) => new Client(srv.base).req('POST', '/api/app/login', { resellerId: id, username, password });
async function mk(biz, user) { const r = (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: biz, email: `${user}@example.com`, username: user, password: PW })).data; return r.resellerId; }
const lockOut = async (id, user) => { for (let i = 0; i < 6; i++) assert.equal((await signin(id, user, 'wrong-password-1')).status, 401); const r = await signin(id, user, PW); assert.equal(r.status, 429); assert.equal(r.data.code, 'LOGIN_LOCKED'); };
const rows = (key) => d ? d.prepare("SELECT kind FROM security_blocks WHERE subject = ? AND kind = 'lockout'").all(key) : [];

test('Firewall page: a locked sign-in is listed, Unlock clears it, the person can sign in, and it is audited', async () => {
  const code = await mk('Lock Co', 'lola'), key = `lola@${code}`.toLowerCase();
  await lockOut(code, 'lola');
  if (sqlite) { await sleep(300); assert.equal(rows(key).length, 1, 'the lockout is saved in the database'); }
  const fw = (await host.req('GET', '/api/host/firewall')).data; const l = fw.lockouts.find(x => x.key === key);
  assert.ok(l && l.kind === 'signin' && l.who === key && l.expires > Date.now(), 'listed with the sign-in name');
  assert.equal(JSON.stringify(fw.lockouts).includes('pw_hash'), false);
  const r = await host.req('POST', '/api/host/firewall/unlock', { key }); assert.equal(r.status, 200);
  assert.equal((await signin(code, 'lola', PW)).status, 200, 'sign-in works again');
  if (sqlite) { await sleep(300); assert.equal(rows(key).length, 0, 'the saved lockout is gone from the database'); }
  assert.equal((await host.req('GET', '/api/host/firewall')).data.lockouts.some(x => x.key === key), false);
  assert.equal((await host.req('POST', '/api/host/firewall/unlock', { key })).data.code, 'NOT_LOCKED', 'nothing left to unlock');
  const a = (await host.req('GET', '/api/host/audit?type=blocks')).data.rows.find(x => x.event === 'lockout.lifted');
  assert.ok(a, 'audit entry in Bans and lockouts'); assert.equal(a.actor, 'admin'); assert.equal(a.label, 'Sign-in unlocked'); assert.ok(a.message.includes(key));
});

test('account detail: a locked person shows as locked, Unlock needs a reason, is audited against the account, and never touches the password', async () => {
  const code = await mk('Detail Co', 'dina'), key = `dina@${code}`.toLowerCase();
  await lockOut(code, 'dina');
  const acc = (await host.req('GET', '/api/host/accounts')).data.find(x => x.account_code === code);
  let det = (await host.req('GET', `/api/host/accounts/${acc.id}`)).data, u = det.users[0]; assert.equal(u.locked, true);
  assert.equal((await host.req('POST', `/api/host/accounts/${acc.id}/users/${u.id}/unlock`, {})).data.code, 'REASON_REQUIRED');
  const hashBefore = sqlite ? d.prepare('SELECT pw_hash FROM account_users WHERE id = ?').get(u.id).pw_hash : null;
  assert.equal((await host.req('POST', `/api/host/accounts/${acc.id}/users/${u.id}/unlock`, { reason: 'Caller forgot their password' })).status, 200);
  det = (await host.req('GET', `/api/host/accounts/${acc.id}`)).data; assert.equal(det.users[0].locked, false);
  assert.equal((await signin(code, 'dina', PW)).status, 200);
  if (sqlite) assert.equal(d.prepare('SELECT pw_hash FROM account_users WHERE id = ?').get(u.id).pw_hash, hashBefore, 'the password is untouched');
  assert.equal((await host.req('POST', `/api/host/accounts/${acc.id}/users/${u.id}/unlock`, { reason: 'again please' })).data.code, 'NOT_LOCKED');
  const a = (await host.req('GET', `/api/host/audit?type=blocks&q=${code}`)).data.rows.find(x => x.event === 'lockout.lifted');
  assert.ok(a && a.account_code === code && /Caller forgot/.test(a.message), 'audit names the account and the reason');
  assert.ok(!JSON.stringify(det).includes(PW));
});

test('only a signed-in Host administrator can unlock: no session and a reseller session are refused, and the lockout stays', async () => {
  const code = await mk('Role Co', 'rita'), key = `rita@${code}`.toLowerCase();
  await lockOut(code, 'rita');
  const anon = new Client(srv.base); assert.equal((await anon.req('POST', '/api/host/firewall/unlock', { key })).status, 401);
  const other = await mk('Other Co', 'omar'), rs = new Client(srv.base); assert.equal((await rs.req('POST', '/api/app/login', { resellerId: other, username: 'omar', password: PW })).status, 200);
  assert.ok([401, 403, 404].includes((await rs.req('POST', '/api/host/firewall/unlock', { key })).status));
  assert.equal((await signin(code, 'rita', PW)).status, 429, 'still locked');
  await host.req('POST', '/api/host/firewall/unlock', { key });
});
