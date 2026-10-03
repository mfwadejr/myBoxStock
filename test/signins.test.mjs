// TEST / signins — sign-in history, own vs team visibility, isolation, session revoke, new-location email, retention setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, sleep } from './helpers.mjs';

let srv, host, a1, a2, other, aLogin, accId;
test.before(async () => { srv = await startServer({ TRUST_PROXY: '1' }); host = new Client(srv.base); a1 = new Client(srv.base); a2 = new Client(srv.base); other = new Client(srv.base); });
test.after(() => srv?.stop());
const PW = 'Sup3rSecretPass!', IP1 = '203.0.113.10', IP2 = '198.51.100.7';
const from = (c, ip) => { c.headers = { 'X-Forwarded-For': ip, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36' }; return c; };

test('setup: two accounts, one with a second person', async () => {
  let r = await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); assert.equal(r.status, 200);
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  r = await a1.req('POST', '/api/app/signup', { businessName: 'One', email: 'one@example.com', username: 'boss', password: PW }); aLogin = r.data.login; accId = r.data.accountCode;
  r = await other.req('POST', '/api/app/signup', { businessName: 'Two', email: 'two@example.com', username: 'zed', password: PW });
  await from(other, '192.0.2.99').req('POST', '/api/app/login', { login: r.data.login, password: PW });
});

test('sign-ins, wrong passwords (grouped) and blocked attempts are recorded with IP and device', async () => {
  from(a1, IP1);
  for (let i = 0; i < 2; i++) assert.equal((await a1.req('POST', '/api/app/login', { login: aLogin, password: 'Wrong-pass-123' })).status, 401);
  assert.equal((await a1.req('POST', '/api/app/login', { login: aLogin, password: PW })).status, 200);
  const r = await a1.req('GET', '/api/app/activity/me'); assert.equal(r.status, 200);
  const ok = r.data.history.find(h => h.result === 'signed_in'), bad = r.data.history.find(h => h.result === 'wrong_password');
  assert.equal(ok.ip, IP1); assert.match(ok.device, /Chrome on Mac/); assert.equal(ok.newIp, false);
  assert.equal(bad.attempts, 2, 'repeated failures from one address are one row');
  assert.equal(r.data.sessions.length, 1); assert.equal(r.data.sessions[0].current, true);
});

test('a sign-in from a new address is flagged and queues an email; the same address is not', async () => {
  from(a2, IP2);
  assert.equal((await a2.req('POST', '/api/app/login', { login: aLogin, password: PW })).status, 200);
  let r = await a2.req('GET', '/api/app/activity/me');
  assert.equal(r.data.history[0].ip, IP2); assert.equal(r.data.history[0].newIp, true); assert.equal(r.data.sessions.length, 2);
  r = await host.req('GET', '/api/host/mail'); const q = JSON.stringify(r.data);
  assert.match(q, /new_sign_in|sign-in|signed in/i);
});

test('own sessions can be ended; the current one cannot; bad ids are refused', async () => {
  let r = await a1.req('GET', '/api/app/activity/me'); const mine = r.data.sessions.find(s => s.current), theirs = r.data.sessions.find(s => !s.current);
  assert.equal((await a1.req('POST', `/api/app/activity/sessions/${mine.id}/revoke`)).data.ok, false);
  assert.equal((await a1.req('POST', '/api/app/activity/sessions/zzz/revoke')).status, 400);
  assert.equal((await a1.req('POST', `/api/app/activity/sessions/${theirs.id}/revoke`)).data.ok, true);
  assert.equal((await a2.req('GET', '/api/app/me')).status, 401, 'the other device was signed out');
});

test('team view needs the Administrator right and never crosses accounts', async () => {
  let r = await a1.req('POST', '/api/app/users', { username: 'viewer', email: 'v@example.com', role: 'View', password: PW }); assert.equal(r.status, 200);
  const v = new Client(srv.base); from(v, IP1);
  assert.equal((await v.req('POST', '/api/app/login', { login: r.data.login, password: PW })).status, 200);
  await v.req('POST', '/api/app/change-password', { current: PW, next: 'An0therPass!word' });
  assert.equal((await v.req('GET', '/api/app/activity/team')).status, 403);
  const mineOnly = await v.req('GET', '/api/app/activity/me'); assert.ok(mineOnly.data.history.every(h => h.login === r.data.login));
  r = await a1.req('GET', '/api/app/activity/team'); assert.equal(r.status, 200);
  assert.ok(r.data.history.some(h => h.login === aLogin) && r.data.history.some(h => h.login.startsWith('viewer@')));
  assert.ok(r.data.history.every(h => h.login.endsWith('@' + accId.toLowerCase())), 'only this account');
  r = await other.req('GET', '/api/app/activity/team'); assert.equal(r.status, 200);
  assert.ok(r.data.history.every(h => h.login.startsWith('zed@')) && r.data.history.length >= 1);
  r = await a1.req('GET', '/api/app/users'); assert.ok(r.data.find(u => u.login === aLogin).last_ip);
});

test('blocked sign-ins show up in the history, and retention is a limited host setting', async () => {
  const acc = (await host.req('GET', '/api/host/accounts')).data.find(a => a.account_code === accId);
  await host.req('POST', `/api/host/accounts/${acc.id}/status`, { status: 'suspended' });
  assert.equal((await from(new Client(srv.base), IP1).req('POST', '/api/app/login', { login: aLogin, password: PW })).status, 403);
  await host.req('POST', `/api/host/accounts/${acc.id}/status`, { status: 'active' });
  await a1.req('POST', '/api/app/login', { login: aLogin, password: PW }); // suspending ended the old session
  const r = await a1.req('GET', '/api/app/activity/team'); await sleep(0);
  assert.ok(r.data.history.some(h => h.result === 'blocked'));
  for (const bad of [3, 1000, 'x']) assert.equal((await host.req('PUT', '/api/host/settings', { signInHistoryDays: bad })).status, 400);
  assert.equal((await host.req('PUT', '/api/host/settings', { signInHistoryDays: 30 })).status, 200);
  assert.equal((await host.req('GET', '/api/host/settings')).data.signInHistoryDays, 30);
});
