// TEST / batch18 — announcement banner (Host to every customer), sign-in clean-up and sign out everyone, the extra customer emails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from './helpers.mjs';

const PW = 'Sup3rSecretPass!', IP = '203.0.113.10';
let srv, host, boss, mate;
test.before(async () => {
  srv = await startServer({ TRUST_PROXY: '1' }); host = new Client(srv.base); boss = new Client(srv.base); mate = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
});
test.after(() => srv?.stop());
const browserLike = (c, ip, ua) => { c.headers = { 'X-Forwarded-For': ip, 'User-Agent': ua }; return c; };

test('announcement: saved by the Host, shown to signed-in customers, ended by its last day, checked', async () => {
  let r = await boss.req('POST', '/api/app/signup', { businessName: 'Ann Co', email: 'ann@example.com', username: 'anna', password: PW });
  const login = r.data.login; await boss.req('POST', '/api/app/login', { login, password: PW });
  assert.equal((await boss.req('GET', '/api/app/me')).data.announcement, null, 'nothing is shown by default');
  assert.equal((await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: '', level: 'info' })).status, 400, 'a message is needed');
  assert.equal((await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'x'.repeat(401), level: 'info' })).status, 400);
  assert.equal((await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'Hi', level: 'loud' })).status, 400);
  assert.equal((await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'Maintenance Saturday <b>2 AM</b>', level: 'warning', until: '' })).status, 200);
  const a = (await boss.req('GET', '/api/app/announcement')).data.announcement; assert.equal(a.text, 'Maintenance Saturday <b>2 AM</b>', 'stored as plain text (the app escapes it)'); assert.equal(a.level, 'warning');
  assert.equal((await boss.req('GET', '/api/app/me')).data.announcement.id, a.id);
  await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'Maintenance Saturday <b>2 AM</b>', level: 'warning', until: '' });
  assert.equal((await boss.req('GET', '/api/app/announcement')).data.announcement.id, a.id, 'saving the same message keeps its id, so a closed banner stays closed');
  await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'Changed', level: 'info', until: '' });
  assert.notEqual((await boss.req('GET', '/api/app/announcement')).data.announcement.id, a.id, 'a new message gets a new id');
  await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'Old news', level: 'info', until: '2020-01-01' });
  assert.equal((await boss.req('GET', '/api/app/announcement')).data.announcement, null, 'past its last day it is gone');
  await host.req('PUT', '/api/host/settings/announcement', { enabled: false, text: 'Off', level: 'info', until: '' });
  assert.equal((await boss.req('GET', '/api/app/announcement')).data.announcement, null);
  assert.equal((await host.req('GET', '/api/host/settings')).data.announcement.text, 'Off');
});

test('sign-ins from the same browser replace each other; Administrators can sign out everyone else, or everyone', async () => {
  const r = await boss.req('POST', '/api/app/signup', { businessName: 'Out Co', email: 'out@example.com', username: 'olly', password: PW }), login = r.data.login;
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', UA2 = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36';
  browserLike(boss, IP, UA);
  for (let i = 0; i < 3; i++) assert.equal((await boss.req('POST', '/api/app/login', { login, password: PW })).status, 200);
  let s = (await boss.req('GET', '/api/app/activity/team')).data.sessions; assert.equal(s.length, 1, 'three sign-ins from one browser and address are one row');
  const add = await boss.req('POST', '/api/app/users', { username: 'mia', email: 'mia@example.com', role: 'Standard', password: PW }); assert.equal(add.status, 200, JSON.stringify(add.data));
  const temp = PW;
  browserLike(mate, '198.51.100.7', UA2); const ml = add.data.login;
  assert.equal((await mate.req('POST', '/api/app/login', { login: ml, password: temp })).status, 200);
  s = (await boss.req('GET', '/api/app/activity/team')).data.sessions; assert.equal(s.length, 2, 'a different browser is a different row');
  assert.equal((await mate.req('POST', '/api/app/activity/team/revoke-others')).status, 403, 'only Administrators');
  let o = await boss.req('POST', '/api/app/activity/team/revoke-others'); assert.equal(o.data.ok, true); assert.equal(o.data.count, 1);
  assert.equal((await mate.req('GET', '/api/app/me')).status, 401, 'the other person is signed out');
  assert.equal((await boss.req('GET', '/api/app/me')).status, 200, 'I am not');
  o = await boss.req('POST', '/api/app/activity/team/revoke-all'); assert.equal(o.data.ok, true);
  assert.equal((await boss.req('GET', '/api/app/me')).status, 401, 'everyone, including me');
});

test('customer emails: Sale voided and Thank you can be previewed and are accepted for sending', async () => {
  const c = new Client(srv.base), r = await c.req('POST', '/api/app/signup', { businessName: 'Mail Co', email: 'm@example.com', username: 'moe', password: PW });
  const lg = await c.req('POST', '/api/app/login', { resellerId: r.data.resellerId, username: 'moe', password: PW }); assert.equal(lg.status, 200, JSON.stringify([r.data, lg.data]));
  const tr = await c.req('GET', '/api/app/receipt-email/templates'); assert.equal(tr.status, 200, JSON.stringify(tr.data)); const t = tr.data.templates; assert.deepEqual(t.map(x => x.key), ['receipt', 'sale_voided', 'thank_you', 'own_mail_test']);
  for (const key of ['sale_voided', 'thank_you']) { const p = await c.req('POST', '/api/app/receipt-email/preview', { key, wording: { title: 'Hello there' } }); assert.equal(p.status, 200); assert.match(p.data.subject, /Mail Co/); assert.deepEqual(p.data.problems, []); }
  assert.match((await c.req('POST', '/api/app/receipt-email/preview', { key: 'thank_you' })).data.text, /Alex Customer/);
  const bad = await c.req('POST', '/api/app/receipt-email/preview', { key: 'sale_voided', wording: { subject: 'Cancelled', body: 'No receipt number here' } }); assert.equal(bad.data.problems.length, 1, 'the receipt number must stay in the voided notice');
  const ty = await c.req('POST', '/api/app/receipt-email', { kind: 'thank_you', to: 'buyer@example.com', receiptNo: 'S-1', customer: 'Sam', text: '' });
  assert.equal(ty.data.code, 'RECEIPT_MAIL_OFF', 'a thank-you needs no receipt text; it is only refused because site email is off here');
  const rc = await c.req('POST', '/api/app/receipt-email', { kind: 'receipt', to: 'buyer@example.com', receiptNo: 'S-1', text: '' }); assert.equal(rc.data.code, 'RECEIPT_MAIL_BAD', 'a receipt still needs its text');
});

test('proxy count: a change that would lock the Host out of the Host Console is refused before it is saved', async () => {
  const h = new Client(srv.base); h.headers = { 'X-Forwarded-For': '198.51.100.20' };
  await h.req('POST', '/api/host/login', { login: 'admin', password: PW });
  const add = await h.req('POST', '/api/host/firewall/rules', { kind: 'host', cidr: '198.51.100.20', note: 'me' }); assert.equal(add.status, 200, JSON.stringify(add.data));
  const on = await h.req('PUT', '/api/host/firewall/host-access', { enabled: true }); assert.equal(on.status, 200, JSON.stringify(on.data));
  const bad = await h.req('PUT', '/api/host/settings', { signupsEnabled: true, runtime: { trustProxy: '' } });
  assert.equal(bad.status, 400); assert.equal(bad.data.code, 'PROXY_LOCKOUT');
  const ok = await h.req('PUT', '/api/host/settings', { signupsEnabled: true, runtime: { trustProxy: '1' } }); assert.equal(ok.status, 200, 'the same count is fine');
});
