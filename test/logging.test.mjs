// TEST / logging — everything is logged, raw + human readable + database, in its own area, without secrets or business data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { enableVault, putRecord } from './vault-helper.mjs';
import { startServer, Client, sleep, allLogText, readJsonl, readHuman } from './helpers.mjs';
import { AREAS } from '../src/logging/areas.mjs';

let srv, host, alice;
const PW = 'Sup3rSecretPass!', SECRET_UID = 'ALICE-SECRET-UID-9931';
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base); alice = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 3, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1, hostConsoleAllowOnly: false });
});
test.after(() => srv?.stop());

test('failed sign-ins are logged (raw, human, database) with the reason', async () => {
  const c = new Client(srv.base);
  await c.req('POST', '/api/app/login', { login: 'ghost@bx-aaaaaa', password: 'wrong-password-1' });
  await c.req('POST', '/api/host/login', { login: 'admin', password: 'wrong-password-2' });
  await sleep(700);
  const raw = readJsonl(srv.logDir, 'auth').filter(e => e.event === 'login.failed');
  assert.equal(raw.length, 2);
  assert.ok(raw.some(e => e.data.reason === 'no such user' && e.data.realm === 'app'));
  assert.ok(raw.some(e => e.data.reason === 'wrong password' && e.data.realm === 'host'));
  assert.ok(readHuman(srv.logDir, 'auth').some(l => /WARN\s+login\.failed\s+Failed sign-in for "ghost@bx-aaaaaa" — no such user/.test(l)));
  const db = (await host.req('GET', '/api/host/logs?area=auth&q=failed')).data.rows;
  assert.ok(db.length >= 2); assert.ok(db.every(r => r.area === 'auth' && JSON.parse(r.raw).event));
});

test('too many attempts: firewall rate limit and lockout are logged in the security area', async () => {
  const c = new Client(srv.base);
  for (let i = 0; i < 6; i++) await c.req('POST', '/api/app/login', { login: 'nobody@bx-bbbbbb', password: 'wrong-password-3' });
  await sleep(700);
  const sec = readJsonl(srv.logDir, 'security');
  assert.ok(sec.some(e => e.event === 'rate_limit.auth' && e.ip && e.data.limit === 3), 'rate_limit.auth logged');
  assert.ok(readHuman(srv.logDir, 'security').some(l => /rate_limit\.auth\s+Too many sign-in attempts from/.test(l)));
});

test('lockout after repeated failures is logged', async () => {
  await host.req('PUT', '/api/host/firewall/limits', { enabled: false });
  const c = new Client(srv.base);
  for (let i = 0; i < 7; i++) await c.req('POST', '/api/app/login', { login: 'victim@bx-cccccc', password: 'wrong-password-4' });
  await sleep(500);
  assert.ok(readJsonl(srv.logDir, 'auth').some(e => e.event === 'lockout.started'));
  assert.ok(readJsonl(srv.logDir, 'auth').some(e => e.event === 'login.locked_out'));
});

test('admin actions, backups, mail and http requests land in their own areas', async () => {
  await host.req('POST', '/api/host/firewall/rules', { kind: 'allow', cidr: '10.1.2.3', note: 'office' });
  await host.req('POST', '/api/host/backups');
  const s = await alice.req('POST', '/api/app/signup', { businessName: 'Alice Boxes', email: 'alice@example.com', username: 'alice', password: PW });
  await alice.req('POST', '/api/app/login', { login: s.data.login, password: PW });
  const { adk } = await enableVault(alice, PW); await putRecord(alice, adk, 'item', { uid: SECRET_UID, model: 'V6' });
  await sleep(900);
  assert.ok(readJsonl(srv.logDir, 'security').some(e => e.event === 'rule.added' && e.data.cidr === '10.1.2.3' && e.actor === 'admin'));
  assert.ok(readJsonl(srv.logDir, 'backup').some(e => e.event === 'create.done'));
  assert.ok(readJsonl(srv.logDir, 'mail').some(e => e.event === 'queued' && e.data.template === 'welcome'));
  assert.ok(readJsonl(srv.logDir, 'tenant').some(e => e.event === 'account.created'));
  assert.ok(readJsonl(srv.logDir, 'http').some(e => e.event === 'request' && e.data.path === '/api/app/signup' && e.data.status === 200));
  assert.ok(readJsonl(srv.logDir, 'system').some(e => e.event === 'started'));
  assert.ok(readJsonl(srv.logDir, 'database').some(e => e.event === 'migrate.done'));
  assert.ok(readJsonl(srv.logDir, 'auth').some(e => e.event === 'session.created'));
});

test('raw and human logs stay in step, and every line is valid JSON with the standard fields', () => {
  for (const area of Object.keys(AREAS)) {
    const f = path.join(srv.logDir, area, `${area}.jsonl`); if (!fs.existsSync(f)) continue;
    const raw = readJsonl(srv.logDir, area), human = readHuman(srv.logDir, area);
    assert.equal(raw.length, human.length, `${area}: jsonl and log line counts match`);
    for (const e of raw) { assert.equal(e.area, area); for (const k of ['ts', 'level', 'event', 'message']) assert.ok(e[k], `${area}: ${k} present`); assert.ok(['debug', 'info', 'warn', 'error'].includes(e.level)); }
  }
});

test('secrets and business data never appear in any log', async () => {
  const text = allLogText(srv.logDir);
  for (const secret of [PW, 'wrong-password-1', 'wrong-password-3', srv.hostPw, SECRET_UID]) assert.ok(!text.includes(secret), `"${secret}" must not be logged`);
  const db = JSON.stringify((await host.req('GET', '/api/host/logs?limit=500')).data.rows);
  assert.ok(!db.includes(SECRET_UID) && !db.includes(PW));
  const cookieTokens = Object.values(alice.jar); for (const t of cookieTokens) assert.ok(!text.includes(t), 'session token not logged');
});

test('host log API hides the private tenant area but lists everything else', async () => {
  const areas = (await host.req('GET', '/api/host/logs/areas')).data.map(a => a.area);
  assert.ok(!areas.includes('tenant')); for (const a of ['auth', 'security', 'host', 'accounts', 'backup', 'mail', 'system', 'database', 'error']) assert.ok(areas.includes(a), a);
  assert.ok(!areas.includes('http'), 'http is file-only and is not offered in the viewer');
  assert.equal((await host.req('GET', '/api/host/logs?area=tenant')).status, 400);
  const all = (await host.req('GET', '/api/host/logs?limit=500')).data.rows; assert.ok(all.length > 5); assert.ok(all.every(r => r.area !== 'tenant' && r.area !== 'http'));
});

test('host support actions are logged in the accounts area with the account id', async () => {
  const acct = (await host.req('GET', '/api/host/accounts')).data[0];
  const detail = (await host.req('GET', `/api/host/accounts/${acct.id}`)).data;
  await host.req('POST', `/api/host/accounts/${acct.id}/users/${detail.users[0].id}/temp-password`, { reason: 'test temp' });
  await sleep(600);
  const e = readJsonl(srv.logDir, 'accounts').find(x => x.event === 'user.temp_password');
  assert.ok(e && e.accountId === acct.id && e.actor === 'admin');
  assert.ok(!allLogText(srv.logDir).match(/tempPassword/i));
});
