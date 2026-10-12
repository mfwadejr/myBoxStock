// TEST / t57-plan-limits — the Limits list, per-plan numbers, enforcement when records and people are added, usage for the reseller, import pre-check,
// the account's plan and own numbers, subscription status, the Get set up list and the trial follow-up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from './helpers.mjs';
import { enableVault, putRecord, addUser } from './vault-helper.mjs';

const PW = 'Sup3rSecretPass!';
let srv, host, acct, c, adk;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  const x = (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Limit Shop', email: 'lim@example.com', username: 'lima', password: PW })).data;
  const list = (await host.req('GET', '/api/host/accounts')).data; acct = { ...x, id: list.find(r => r.account_code === x.resellerId).id };
  c = new Client(srv.base); const lg = await c.req('POST', '/api/app/login', { resellerId: x.resellerId, username: 'lima', password: PW }); assert.equal(lg.status, 200, JSON.stringify(lg.data));
  adk = (await enableVault(c, PW)).adk;
});
test.after(() => srv?.stop());
const put = (body) => host.req('PUT', '/api/host/business/plans', body);

test('limits list is validated and each plan keeps its own numbers', async () => {
  const defs = (await host.req('GET', '/api/host/business/plans')).data.limits.map(l => ({ ...l }));
  defs.find(l => l.id === 'lim-devices').action = 'block'; defs.find(l => l.id === 'lim-users').action = 'block';
  defs.push({ id: 'lim-cust', name: 'Customers last 30 days', counts: 'customer', period: 'd30', warnPct: 50, action: 'block' });
  let r = await put({ plans: [{ name: 'Tiny', price: '5', limits: { 'lim-devices': 3, 'lim-users': 2, 'lim-cust': 1 } }], limits: defs }); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.limits.length, 4);
  assert.equal((await put({ plans: [], limits: [{ name: 'Bad', counts: 'loans', period: 'all', warnPct: 80, action: 'warn' }] })).status, 400, 'loans cannot be counted');
  assert.equal((await put({ plans: [], limits: [{ name: 'Bad', counts: 'item', period: 'all', warnPct: 0, action: 'warn' }] })).status, 400);
  assert.equal((await put({ plans: [], limits: [{ name: 'A', counts: 'item', period: 'all', warnPct: 80, action: 'warn' }, { name: 'a', counts: 'sale', period: 'all', warnPct: 80, action: 'warn' }] })).status, 400, 'limit names are unique');
  const plan = r.data.plans[0];
  assert.equal((await put({ plans: [plan], limits: defs, defaultPlanId: plan.id })).status, 200);
});

test('an account with no plan is not limited; moving it to a plan limits it and blocks at the cap', async () => {
  for (let i = 0; i < 4; i++) assert.equal((await putRecord(c, adk, 'item', { n: i })).status, 200, 'no plan, no limit');
  const planId = (await host.req('GET', '/api/host/business/plans')).data.plans[0].id;
  const base = `/api/host/accounts/${acct.id}/limits`;
  assert.equal((await host.req('POST', base, { planRef: planId })).data.code, 'REASON_REQUIRED');
  assert.equal((await host.req('POST', base, { planRef: 'nope', reason: 'testing' })).status, 400);
  assert.equal((await host.req('POST', base, { planRef: planId, reason: 'put on Tiny', cycle: 'year', providerCustomer: 'cus_1' })).status, 200);
  let blocked = await putRecord(c, adk, 'item', { n: 99 }); assert.equal(blocked.status, 409); assert.equal(blocked.data.code, 'PLAN_LIMIT'); assert.match(blocked.data.error, /allows 3 devices and you have 4/);
  const u = (await c.req('GET', '/api/app/account/plan')).data.usage; const dev = u.find(x => x.id === 'lim-devices'); assert.deepEqual([dev.used, dev.limit, dev.state], [4, 3, 'full']);
  // The account's own number beats the plan's.
  assert.equal((await host.req('POST', base, { planRef: planId, overrides: { 'lim-devices': 6 }, cycle: 'year', providerCustomer: 'cus_1', reason: 'extra room' })).status, 200);
  assert.equal((await putRecord(c, adk, 'item', { n: 5 })).status, 200); assert.equal((await putRecord(c, adk, 'item', { n: 6 })).status, 200);
  assert.equal((await putRecord(c, adk, 'item', { n: 7 })).status, 409, 'now at 6');
  const detail = (await host.req('GET', `/api/host/accounts/${acct.id}`)).data.planInfo;
  assert.equal(detail.cycle, 'year'); assert.equal(detail.providerCustomer, 'cus_1'); assert.equal(detail.overrides['lim-devices'], 6);
});

test('a window only counts records made inside it, and a refused save changes nothing', async () => {
  const before = (await c.req('GET', '/api/app/account/plan')).data.usage.find(x => x.id === 'lim-devices').used;
  // 1 customer allowed in the last 30 days: the first fits, the second does not.
  assert.equal((await putRecord(c, adk, 'customer', { name: 'A' })).status, 200);
  assert.equal((await putRecord(c, adk, 'customer', { name: 'B' })).status, 409);
  assert.equal((await c.req('GET', '/api/app/account/plan')).data.usage.find(x => x.id === 'lim-devices').used, before);
});

test('adding a person respects the team limit; the import pre-check answers without saving', async () => {
  const r1 = await addUser(c, adk, { username: 'second', password: PW + 'x1', role: 'Standard' }); assert.equal(r1.status, 200, JSON.stringify(r1.data));
  const r2 = await addUser(c, adk, { username: 'third', password: PW + 'x2', role: 'Standard' }); assert.equal(r2.status, 409); assert.equal(r2.data.code, 'PLAN_LIMIT');
  assert.equal((await c.req('POST', '/api/app/account/plan/check', { adds: { sale: 1 } })).data.ok, true);
  const over = (await c.req('POST', '/api/app/account/plan/check', { adds: { item: 500 } })).data; assert.equal(over.ok, false); assert.match(over.error, /Nothing was saved/);
});

test('removing a plan that accounts are on is refused; new sign-ups start on the chosen plan', async () => {
  const d = (await host.req('GET', '/api/host/business/plans')).data;
  const r = await put({ plans: [], limits: d.limits }); assert.equal(r.status, 400); assert.match(r.data.error, /used by 1 account/);
  const y = (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'New Shop', email: 'new@example.com', username: 'newa', password: PW })).data;
  const id = (await host.req('GET', '/api/host/accounts')).data.find(a => a.account_code === y.resellerId).id;
  assert.equal((await host.req('GET', `/api/host/accounts/${id}`)).data.planInfo.planRef, d.plans[0].id);
});

test('subscription status, receipts pre-fill, trial follow-up and the Get set up list', async () => {
  const DAY = 86400e3, detail = async () => (await host.req('GET', `/api/host/accounts/${acct.id}`)).data.planInfo;
  assert.equal((await detail()).subscription, 'none', 'a trial has no subscription status');
  const until = (d) => new Date(Date.now() + d * DAY).toISOString().slice(0, 10);
  await host.req('POST', `/api/host/accounts/${acct.id}/plan`, { plan: 'paid', until: until(30), reason: 'paid' }); assert.equal((await detail()).subscription, 'current');
  await host.req('POST', `/api/host/accounts/${acct.id}/plan`, { plan: 'paid', until: until(3), reason: 'paid' }); assert.equal((await detail()).subscription, 'due');
  const next = (await detail()).nextPaidThrough; assert.ok(next > until(300) && next < until(400), 'a yearly account moves on by a year: ' + next);
  const rn = (await host.req('GET', '/api/host/business/renewals')).data.renewals.find(x => x.id === acct.id); assert.deepEqual([rn.status, rn.cycle], ['due', 'year']);
  const setup = (await host.req('GET', '/api/host/business/setup')).data; assert.deepEqual(setup.items.map(i => i.key), ['email', 'backups', 'firewall', 'plans']); assert.equal(setup.items.find(i => i.key === 'plans').done, true);
  const y = (await host.req('GET', '/api/host/accounts')).data.find(a => a.business_name === 'New Shop');
  const pre = await host.req('GET', `/api/host/business/trials/${y.id}/nudge`); assert.equal(pre.status, 200); assert.match(pre.data.text, /not added any devices yet/);
  assert.equal((await host.req('GET', `/api/host/business/trials/${acct.id}/nudge`)).status, 400, 'a paid account is not a trial');
  const trials = (await host.req('GET', '/api/host/business/pipeline')).data.trials; assert.equal(trials.find(t => t.id === y.id).devices, 0);
});
