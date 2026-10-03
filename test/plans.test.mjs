// TEST / plans — free trials, plan changes (free/paid), read-only after expiry, billing history, and deleting admins/users.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, readJsonl } from './helpers.mjs';

let srv, host, alice, accId;
test.before(async () => { srv = await startServer(); host = new Client(srv.base); alice = new Client(srv.base); });
test.after(() => srv?.stop());
const STRONG = 'Sup3rSecretPass!';

test('host: trial length is a setting with sane limits', async () => {
  let r = await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); assert.equal(r.status, 200);
  r = await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: STRONG }); assert.equal(r.status, 200);
  r = await host.req('GET', '/api/host/settings'); assert.equal(r.data.trialDays, 14);
  for (const bad of [0, 400, 1.5, 'abc']) assert.equal((await host.req('PUT', '/api/host/settings', { trialDays: bad })).status, 400, `trialDays ${bad}`);
  r = await host.req('PUT', '/api/host/settings', { trialDays: 5 }); assert.equal(r.status, 200);
  assert.equal((await host.req('GET', '/api/host/settings')).data.trialDays, 5);
});

test('sign-up starts a trial and the host can see the new account', async () => {
  let r = await alice.req('GET', '/api/app/public-config'); assert.equal(r.data.trialDays, 5);
  r = await alice.req('POST', '/api/app/signup', { businessName: 'Alice Boxes', email: 'alice@example.com', username: 'alice', password: STRONG });
  assert.equal(r.status, 200); assert.equal(r.data.trialDays, 5);
  r = await alice.req('POST', '/api/app/login', { login: r.data.login, password: STRONG }); assert.equal(r.status, 200);
  r = await alice.req('GET', '/api/app/me'); assert.equal(r.data.user.billing.state, 'trial'); assert.equal(r.data.user.billing.daysLeft, 5); assert.equal(r.data.user.billing.canWrite, true);
  r = await host.req('GET', '/api/host/accounts'); assert.equal(r.data.length, 1);
  const a = r.data[0]; accId = a.id; assert.equal(a.plan, 'trial'); assert.equal(a.billing.state, 'trial');
  r = await host.req('GET', '/api/host/accounts?plan=free'); assert.equal(r.data.length, 0);
  r = await host.req('GET', '/api/host/accounts?plan=trial'); assert.equal(r.data.length, 1);
  r = await host.req('GET', '/api/host/dashboard'); assert.equal(r.data.plans.trial, 1);
});

test('expired plan is read-only (view yes, change no) and the host can comp the account free', async () => {
  assert.equal((await alice.req('POST', '/api/app/inventory', { uid: 'A1' })).status, 200);
  let r = await host.req('POST', `/api/host/accounts/${accId}/plan`, { plan: 'paid', until: '2000-01-01', note: 'simulate lapse' });
  assert.equal(r.status, 200); assert.equal(r.data.billing.state, 'paid_expired');
  r = await alice.req('POST', '/api/app/inventory', { uid: 'A2' }); assert.equal(r.status, 402);
  r = await alice.req('GET', '/api/app/inventory'); assert.equal(r.status, 200); assert.equal(r.data.length, 1);
  r = await host.req('GET', '/api/host/accounts?plan=expired'); assert.equal(r.data.length, 1);
  r = await host.req('POST', `/api/host/accounts/${accId}/plan`, { plan: 'free', note: 'launch partner' }); assert.equal(r.status, 200); assert.equal(r.data.billing.state, 'free');
  assert.equal((await alice.req('POST', '/api/app/inventory', { uid: 'A2' })).status, 200);
  r = await host.req('POST', `/api/host/accounts/${accId}/plan`, { plan: 'trial', days: 10 }); assert.equal(r.data.billing.daysLeft, 10);
  r = await host.req('POST', `/api/host/accounts/${accId}/plan`, { plan: 'trial', days: 5, extend: true }); assert.equal(r.data.billing.daysLeft, 15);
  for (const bad of [{ plan: 'gold' }, { plan: 'trial', days: 0 }, { plan: 'paid', until: 'tomorrow' }]) assert.equal((await host.req('POST', `/api/host/accounts/${accId}/plan`, bad)).status, 400);
  r = await host.req('GET', `/api/host/accounts/${accId}`); assert.ok(r.data.history.length >= 5, 'every change is kept in the plan history');
  assert.ok(r.data.history.some(h => h.note === 'launch partner'));
});

test('plan changes are logged in the accounts area (raw)', async () => {
  const ev = readJsonl(srv.logDir, 'accounts').map(e => e.event);
  assert.ok(ev.includes('trial.started')); assert.ok(ev.includes('plan.changed'));
});

test('deleting people: account admin, host on a user, host on another host admin', async () => {
  let r = await alice.req('GET', '/api/app/me'); const myId = r.data.user.id;
  r = await alice.req('POST', '/api/app/users', { username: 'bob', role: 'Standard', password: STRONG }); assert.equal(r.status, 200);
  r = await alice.req('POST', '/api/app/users', { username: 'carol', role: 'Standard', password: STRONG }); assert.equal(r.status, 200);
  const users = (await alice.req('GET', '/api/app/users')).data, bob = users.find(u => u.username === 'bob'), carol = users.find(u => u.username === 'carol');
  assert.equal((await alice.req('DELETE', `/api/app/users/${myId}`, { confirm: 'x' })).status, 400, 'cannot delete yourself');
  assert.equal((await alice.req('DELETE', `/api/app/users/${bob.id}`, {})).status, 400, 'needs typed confirmation');
  assert.equal((await alice.req('DELETE', `/api/app/users/${bob.id}`, { confirm: bob.login })).status, 200);
  assert.equal((await mk(srv.base).req('POST', '/api/app/login', { login: bob.login, password: STRONG })).status, 401, 'deleted user cannot sign in');
  // a disabled person with the right password is told why; the log records login.blocked
  r = await alice.req('POST', '/api/app/users', { username: 'dave', role: 'Standard', password: STRONG }); assert.equal(r.status, 200);
  const dave = (await alice.req('GET', '/api/app/users')).data.find(u => u.username === 'dave');
  assert.equal((await alice.req('POST', `/api/app/users/${dave.id}/disabled`, { disabled: true })).status, 200);
  r = await mk(srv.base).req('POST', '/api/app/login', { login: dave.login, password: STRONG }); assert.equal(r.status, 403); assert.equal(r.data.code, 'USER_DISABLED');
  assert.ok(readJsonl(srv.logDir, 'auth').some(e => e.event === 'login.blocked' && e.data?.reason === 'USER_DISABLED'));
  assert.equal((await host.req('DELETE', `/api/host/accounts/${accId}/users/${dave.id}`, { confirm: dave.login })).status, 200);
  assert.equal((await host.req('DELETE', `/api/host/accounts/${accId}/users/${carol.id}`, { confirm: carol.login })).status, 200);
  assert.equal((await alice.req('GET', '/api/app/users')).data.length, 1);
  assert.equal((await host.req('DELETE', `/api/host/accounts/${accId}/users/${myId}`, { confirm: users.find(u => u.id === myId).login })).status, 400, 'last Administrator is protected');

  r = await host.req('POST', '/api/host/admins', { username: 'second', password: STRONG }); assert.equal(r.status, 200);
  const admins = (await host.req('GET', '/api/host/admins')).data, me = admins.find(a => a.username === 'admin'), two = admins.find(a => a.username === 'second');
  assert.equal((await host.req('DELETE', `/api/host/admins/${me.id}`, { confirm: 'admin' })).status, 400, 'cannot delete yourself');
  assert.equal((await host.req('DELETE', `/api/host/admins/${two.id}`, { confirm: 'nope' })).status, 400);
  assert.equal((await host.req('DELETE', `/api/host/admins/${two.id}`, { confirm: 'second' })).status, 200);
  assert.equal((await host.req('GET', '/api/host/admins')).data.length, 1);
  const hostEv = readJsonl(srv.logDir, 'host').map(e => e.event), accEv = readJsonl(srv.logDir, 'accounts').map(e => e.event);
  assert.ok(hostEv.includes('admin.deleted')); assert.ok(accEv.includes('user.deleted'));
});
const mk = (base) => new Client(base);
