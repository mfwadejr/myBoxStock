// TEST / block-persistence — sign-in lockouts and IP bans (and the counters leading to them) survive a restart; expired ones do not; unban removes the row.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, restartServer, Client, sleep } from './helpers.mjs';

const PW = 'Sup3rSecretPass!';
const rows = (srv, sql = 'SELECT kind, subject, hits FROM security_blocks ORDER BY kind, subject') => { const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db'), { readOnly: true }); try { return d.prepare(sql).all(); } finally { d.close(); } };
const withDb = (srv, fn) => { const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); try { return fn(d); } finally { d.close(); } };
const attempt = (srv, ip, login) => { const c = new Client(srv.base); c.headers = { 'X-Forwarded-For': ip }; return c.req('POST', '/api/app/login', { login, password: 'wrong-password-9' }); };
const hostIn = async (srv) => { const h = new Client(srv.base); h.headers = { 'X-Forwarded-For': '198.51.100.1' }; let r = await h.req('POST', '/api/host/login', { login: 'admin', password: PW }); if (r.status !== 200) { r = await h.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await h.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW }); } return h; };
const poll = async (fn, ms = 5000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await sleep(150); } return v; };

let srv;
test.after(() => srv?.stop());

test('lockouts, bans and failure counters survive a restart; expired ones do not; unban removes the row', async () => {
  srv = await startServer({ TRUST_PROXY: '1' });
  let host = await hostIn(srv);
  assert.equal((await host.req('PUT', '/api/host/firewall/limits', { enabled: true, authMaxAttempts: 1, banAfterViolations: 2, banMinutes: 15 })).status, 200);
  // Ban an address: the second sign-in attempt in the window is a violation, two violations ban it.
  for (let i = 0; i < 4; i++) await attempt(srv, '203.0.113.9', 'x@bx-aaaaaa');
  assert.equal((await attempt(srv, '203.0.113.9', 'x@bx-aaaaaa')).status, 429);
  assert.equal((await host.req('GET', '/api/host/firewall')).data.bans.some(b => b.ip === '203.0.113.9'), true);
  // Lock an identity out (each attempt from another address so the address limiter does not interfere), and leave another one part-way.
  for (let i = 0; i < 6; i++) await attempt(srv, `192.0.2.${10 + i}`, 'victim@bx-cccccc');
  assert.equal((await attempt(srv, '192.0.2.99', 'victim@bx-cccccc')).data.code, 'LOGIN_LOCKED');
  for (let i = 0; i < 3; i++) await attempt(srv, `192.0.2.${30 + i}`, 'half@bx-eeeeee');
  const saved = await poll(() => { const r = rows(srv); return r.some(x => x.kind === 'ban') && r.some(x => x.kind === 'lockout') && r.some(x => x.kind === 'failures' && x.hits === 3) && r; });
  assert.ok(saved, 'rows written'); assert.equal(saved.find(x => x.kind === 'failures').hits, 3);
  // Plant expired rows, as if an older lockout and ban ran out while the server was off.
  await sleep(300); const gone = new Promise(r => srv.proc.once('exit', r)); srv.proc.kill(); await gone;
  withDb(srv, (d) => { for (const [k, s] of [['ban', '203.0.113.50'], ['lockout', 'old@bx-dddddd']]) d.prepare('INSERT INTO security_blocks (id, kind, subject, hits, reason, created_at, expires_at) VALUES (?,?,?,?,?,?,?)').run('t-' + k, k, s, 0, 'test', 1, Date.now() - 5000); });
  srv = await startServer({ ...srv.env, DATA_DIR: srv.dir });
  assert.equal(rows(srv).some(x => x.subject === '203.0.113.50' || x.subject === 'old@bx-dddddd'), false, 'expired rows are removed at start');
  // Still enforced after the restart.
  assert.equal((await attempt(srv, '203.0.113.9', 'x@bx-aaaaaa')).status, 429, 'ban still enforced');
  assert.equal((await attempt(srv, '192.0.2.200', 'victim@bx-cccccc')).data.code, 'LOGIN_LOCKED', 'lockout still enforced');
  assert.equal((await attempt(srv, '203.0.113.50', 'old@bx-dddddd')).data.code, 'LOGIN_INVALID', 'expired lockout and ban are gone');
  // The counter carried over: three more failures reach the limit of six.
  for (let i = 0; i < 3; i++) await attempt(srv, `192.0.2.${60 + i}`, 'half@bx-eeeeee');
  assert.equal((await attempt(srv, '192.0.2.98', 'half@bx-eeeeee')).data.code, 'LOGIN_LOCKED', 'failure counter survived the restart');
  // Manual unban removes the row (and the ban).
  host = await hostIn(srv);
  assert.equal((await host.req('GET', '/api/host/firewall')).data.bans.some(b => b.ip === '203.0.113.9'), true, 'listed as banned after restart');
  assert.equal((await host.req('POST', '/api/host/firewall/unban', { ip: '203.0.113.9' })).status, 200);
  assert.equal(await poll(() => !rows(srv).some(x => x.kind === 'ban' && x.subject === '203.0.113.9')), true, 'row removed');
  assert.notEqual((await attempt(srv, '203.0.113.9', 'x@bx-aaaaaa')).status, 500);
  // And it stays unbanned after another restart.
  srv = await restartServer(srv);
  assert.equal(rows(srv).some(x => x.kind === 'ban' && x.subject === '203.0.113.9'), false);
  assert.equal((await attempt(srv, '203.0.113.9', 'x@bx-aaaaaa')).data.code, 'LOGIN_INVALID');
});
