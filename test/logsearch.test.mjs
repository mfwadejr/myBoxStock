// TEST / log search — filters, paging, export, and that using the viewer is itself logged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, readJsonl, sleep } from './helpers.mjs';

let srv, host, alice, code;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base); alice = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: 'Sup3rSecretPass!' });
  const r = await alice.req('POST', '/api/app/signup', { businessName: 'Alice Boxes', email: 'alice@example.com', username: 'alice', password: 'Sup3rSecretPass!' });
  code = r.data.accountCode;
  await alice.req('POST', '/api/app/login', { login: r.data.login, password: 'wrong-password-1' });
  await alice.req('POST', '/api/app/login', { login: r.data.login, password: 'Sup3rSecretPass!' });
});
test.after(() => srv?.stop());
const logs = async (qs) => (await host.req('GET', '/api/host/logs?' + qs)).data;

test('areas: http is not offered; filters narrow the results', async () => {
  const areas = (await host.req('GET', '/api/host/logs/areas')).data.map(a => a.area);
  assert.ok(!areas.includes('http') && !areas.includes('tenant') && areas.includes('auth'));
  const failed = await logs('event=login.failed'); assert.ok(failed.rows.length >= 1 && failed.rows.every(r => r.event === 'login.failed'));
  const bad = await logs('level=warn,error'); assert.ok(bad.rows.length >= 1 && bad.rows.every(r => ['warn', 'error'].includes(r.level)));
  assert.equal((await host.req('GET', '/api/host/logs?area=http')).status, 400);
  assert.equal((await host.req('GET', '/api/host/logs?area=nope')).data.code, 'UNKNOWN_LOG_AREA');
});

test('free text finds people, IP addresses and account IDs; time range applies', async () => {
  assert.ok((await logs('q=alice')).rows.length >= 1);
  const byCode = await logs('q=' + code.toLowerCase()); assert.ok(byCode.rows.length >= 1, 'account ID is searchable');
  assert.ok(byCode.rows.some(r => r.account_code === code), 'rows carry the account ID');
  assert.equal((await logs('account=' + code)).rows.every(r => r.account_code === code), true);
  assert.ok((await logs('q=127.0.0.1')).rows.length >= 1, 'IP is searchable');
  assert.equal((await host.req('GET', '/api/host/logs?q=%25')).status, 200, 'wildcard characters are harmless');
  assert.equal((await logs('from=' + (Date.now() + 3600e3))).rows.length, 0, 'future start returns nothing');
  assert.ok((await logs('from=' + (Date.now() - 3600e3))).rows.length > 0);
});

test('paging walks every row exactly once', async () => {
  const all = (await logs('limit=500')).rows; assert.ok(all.length > 6 && all.length < 500);
  const seen = []; let before = '', pages = 0;
  do { const d = await logs(`limit=3${before ? '&before=' + before : ''}`); seen.push(...d.rows.map(r => r.id)); before = d.next; pages++; } while (before && pages < 200);
  assert.equal(new Set(seen).size, seen.length, 'no repeats');
  assert.ok(seen.length >= all.length, 'no gaps (new rows may arrive while paging)');
});

test('export as CSV and JSON, and the export is logged', async () => {
  let res = await fetch(srv.base + '/api/host/logs/export?format=csv&area=auth', { headers: { Cookie: Object.entries(host.jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
  assert.equal(res.status, 200); assert.match(res.headers.get('content-disposition'), /\.csv"/);
  const csv = await res.text(); assert.ok(csv.startsWith('time,level,area,event,actor,account,ip,message')); assert.ok(csv.split('\n').length > 2);
  res = await fetch(srv.base + '/api/host/logs/export?format=json&level=warn', { headers: { Cookie: Object.entries(host.jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
  const json = await res.json(); assert.ok(Array.isArray(json) && json.every(r => r.level === 'warn' && typeof r.raw === 'object'));
  await sleep(300);
  assert.ok(readJsonl(srv.logDir, 'host').some(e => e.event === 'logs.exported'));
});
