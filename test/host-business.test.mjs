// TEST / host-business — Batch A: support actions need a reason and show in the Support history; account health signals and filters;
// the signup and trial pipeline; renewals; the plan list; receipt records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, sleep } from './helpers.mjs';

const PW = 'Sup3rSecretPass!';
let srv, host, a, b;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
  const mk = async (biz, email, user) => (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: biz, email, username: user, password: PW })).data;
  const x = await mk('Alpha Shop', 'alpha@example.com', 'alpha'), y = await mk('Beta Shop', 'beta@example.com', 'bruno');
  const list = (await host.req('GET', '/api/host/accounts')).data;
  a = { ...x, id: list.find(r => r.account_code === x.resellerId).id }; b = { ...y, id: list.find(r => r.account_code === y.resellerId).id };
});
test.after(() => srv?.stop());
const detail = async (acc) => (await host.req('GET', `/api/host/accounts/${acc.id}`)).data;

test('every support action needs a reason, which is logged and shown in the Support history', async () => {
  const u = (await detail(a)).users[0], base = `/api/host/accounts/${a.id}`;
  for (const [m, p, body] of [['POST', `${base}/status`, { status: 'suspended' }], ['POST', `${base}/users/${u.id}/reset-link`, {}], ['POST', `${base}/users/${u.id}/temp-password`, {}], ['POST', `${base}/users/${u.id}/reset-mfa`, {}], ['POST', `${base}/users/${u.id}/sign-out`, {}], ['POST', `${base}/users/${u.id}/disabled`, { disabled: true }], ['POST', `${base}/plan`, { plan: 'free' }]]) {
    const r = await host.req(m, p, body); assert.equal(r.status, 400, p); assert.equal(r.data.code, 'REASON_REQUIRED', p);
    assert.equal((await host.req(m, p, { ...body, reason: 'ab' })).status, 400, 'two letters is not a reason');
  }
  assert.equal((await host.req('POST', `${base}/users/${u.id}/sign-out`, { reason: 'customer reported a lost phone' })).status, 200);
  assert.equal((await host.req('POST', `${base}/status`, { status: 'suspended', reason: 'chargeback dispute' })).status, 200);
  assert.equal((await host.req('POST', `${base}/status`, { status: 'active', reason: 'dispute resolved' })).status, 200);
  await sleep(700); // the log is written to the database a moment later
  const sup = (await detail(a)).support;
  assert.ok(sup.some(s => s.event === 'user.signed_out' && s.reason === 'customer reported a lost phone' && s.actor === 'admin'));
  assert.ok(sup.some(s => s.event === 'account.suspended' && s.reason === 'chargeback dispute') && sup.some(s => s.event === 'account.active' && s.reason === 'dispute resolved'));
});

test('account health: signals and filters', async () => {
  const all = (await host.req('GET', '/api/host/accounts')).data, row = all.find(r => r.id === a.id);
  assert.equal(row.encrypted, 0); assert.equal(row.admins_2fa, 0); assert.ok(row.unverified === 0 || row.unverified === 1);
  assert.equal(row.last_login, null, 'never signed in');
  const f = async (h) => (await host.req('GET', `/api/host/accounts?health=${h}`)).data.map(r => r.id);
  assert.ok((await f('not_encrypted')).includes(a.id) && (await f('no_2fa')).includes(a.id));
  assert.equal((await f('no_recovery')).includes(a.id), false, 'not encrypted yet, so no recovery key to miss');
  assert.equal((await f('closing')).length, 0); assert.equal((await f('suspended')).length, 0);
  assert.equal((await f('inactive30')).includes(a.id), false, 'created just now');
  await new Client(srv.base).req('POST', '/api/app/login', { resellerId: a.resellerId, username: 'alpha', password: PW });
  assert.ok((await host.req('GET', '/api/host/accounts')).data.find(r => r.id === a.id).last_login > 0);
});

test('pipeline and renewals', async () => {
  let p = (await host.req('GET', '/api/host/business/pipeline')).data;
  assert.equal(p.signups.total, 2); assert.equal(p.signups.week, 2); assert.equal(p.trials.length, 2); assert.equal(p.outcome.trial, 2); assert.ok(p.trials[0].daysLeft >= 13);
  assert.equal((await host.req('POST', `/api/host/accounts/${b.id}/plan`, { plan: 'paid', until: new Date(Date.now() + 10 * 86400e3).toISOString().slice(0, 10), note: 'paid for a month' })).status, 200);
  p = (await host.req('GET', '/api/host/business/pipeline')).data; assert.equal(p.outcome.paid, 1); assert.equal(p.outcome.trial, 1);
  const rn = (await host.req('GET', '/api/host/business/renewals')).data.renewals;
  assert.ok(rn.some(x => x.id === b.id && x.kind === 'paid' && !x.lapsed), 'paid account ending in 10 days is listed');
  assert.ok(rn.some(x => x.id === a.id && x.kind === 'trial'), 'a trial ending within 30 days is listed too');
});

test('plans: saved, validated and logged', async () => {
  assert.deepEqual((await host.req('GET', '/api/host/business/plans')).data.plans, []);
  const good = [{ name: 'Starter', price: '19.00', interval: 'month', maxUsers: 3, maxDevices: 500, note: 'small shops' }, { name: 'Pro', price: '190', interval: 'year', maxUsers: '', maxDevices: '' }];
  let r = await host.req('PUT', '/api/host/business/plans', { plans: good }); assert.equal(r.status, 200);
  assert.deepEqual(r.data.plans.map(p => [p.name, p.priceCents, p.interval, p.maxUsers, p.maxDevices]), [['Starter', 1900, 'month', 3, 500], ['Pro', 19000, 'year', null, null]]);
  assert.equal((await host.req('PUT', '/api/host/business/plans', { plans: [{ name: '' }] })).status, 400);
  assert.equal((await host.req('PUT', '/api/host/business/plans', { plans: [{ name: 'A' }, { name: 'a' }] })).status, 400, 'names are unique');
  assert.equal((await host.req('PUT', '/api/host/business/plans', { plans: [{ name: 'X', maxUsers: 'lots' }] })).status, 400);
  assert.equal((await host.req('GET', '/api/host/business/plans')).data.plans.length, 2, 'bad saves change nothing');
});

test('receipts: recorded against the account, optionally extending the paid period; removal needs a reason', async () => {
  const base = `/api/host/accounts/${a.id}/receipts`;
  assert.equal((await host.req('POST', base, { amount: 'abc' })).status, 400); assert.equal((await host.req('POST', base, { amount: '10', currency: 'dollars' })).status, 400);
  assert.equal((await host.req('POST', base, { amount: '10', paidThrough: 'soon' })).status, 400);
  let r = await host.req('POST', base, { amount: '29.00', currency: 'usd', method: 'Bank transfer', reference: 'INV-1', paidThrough: '2099-01-31', applyPlan: true, note: 'first month' }); assert.equal(r.status, 200);
  let d = await detail(a); assert.equal(d.receipts.length, 1); assert.deepEqual([d.receipts[0].amount_cents, d.receipts[0].currency, d.receipts[0].reference], [2900, 'USD', 'INV-1']);
  assert.equal(d.account.billing.state, 'paid'); assert.ok(d.history.some(h => /Payment received/.test(h.note || '')));
  assert.equal((await host.req('DELETE', `${base}/${d.receipts[0].id}`)).status, 400);
  assert.equal((await host.req('DELETE', `${base}/${d.receipts[0].id}`, { reason: 'entered twice' })).status, 200);
  assert.equal((await detail(a)).receipts.length, 0);
});
