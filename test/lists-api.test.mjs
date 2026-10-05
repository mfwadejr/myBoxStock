// TEST / lists-api — feeds report a total on the first page and page on with `before` / `offset`: Logs, Audit, Alerts, sign-in history.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client } from './helpers.mjs';

const PW = 'Sup3rSecretPass!';
let srv, host, app, db, login;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base); app = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  login = (await app.req('POST', '/api/app/signup', { businessName: 'Lists', email: 'l@example.com', username: 'lee', password: PW })).data.login;
  db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); db.exec('PRAGMA busy_timeout=5000');
});
test.after(() => { db?.close(); srv?.stop(); });

test('Logs and Audit count on the first page and page on with `before`', async () => {
  const ins = db.prepare("INSERT INTO event_log (id, ts, level, area, event, actor, ip, message, raw) VALUES (?, ?, 'info', 'host', 'test.seed', 'admin', '203.0.113.9', ?, '{}')");
  const t = Date.now() - 60000; for (let i = 0; i < 230; i++) ins.run('lst-' + String(i).padStart(4, '0'), t - i * 10, `Seeded ${i}`);
  for (const base of ['/api/host/logs', '/api/host/audit']) {
    let r = await host.req('GET', `${base}?q=seeded`); assert.equal(r.data.rows.length, 100); assert.equal(r.data.total, 230); assert.ok(r.data.next);
    const seen = new Set(r.data.rows.map(x => x.id));
    r = await host.req('GET', `${base}?q=seeded&before=${r.data.next}`); assert.equal(r.data.total, undefined, 'only the first page counts'); assert.equal(r.data.rows.length, 100);
    r.data.rows.forEach(x => { assert.ok(!seen.has(x.id)); seen.add(x.id); });
    r = await host.req('GET', `${base}?q=seeded&before=${r.data.next}`); assert.equal(r.data.rows.length, 30); assert.equal(r.data.next, null);
  }
});

test('Alerts: set-aside and cleared lists are counted and page with offset', async () => {
  const ins = db.prepare("INSERT INTO alerts (id, kind, dedupe_key, level, title, detail, first_at, last_at, occurrences, status, resolved_at) VALUES (?, 'x', ?, 'warn', ?, '', ?, ?, 1, 'resolved', ?)");
  for (let i = 0; i < 130; i++) ins.run('al-' + i, 'k' + i, 'Old problem ' + i, 1000 + i, 1000 + i, 5000 + i);
  let r = await host.req('GET', '/api/host/alerts'); assert.equal(r.data.recent.length, 100); assert.equal(r.data.totals.recent, 130); assert.equal(r.data.totals.quiet, 0);
  r = await host.req('GET', '/api/host/alerts/more?status=resolved&offset=100'); assert.equal(r.data.rows.length, 30);
  r = await host.req('GET', '/api/host/alerts/more?status=open&offset=0'); assert.deepEqual(r.data.rows, [], 'open alerts are never paged');
});

test('Sign-in history reports its total and pages 100 at a time', async () => {
  await app.req('POST', '/api/app/login', { login, password: PW }); const me = db.prepare('SELECT id, account_id, login FROM account_users WHERE login = ?').get(login), ins = db.prepare("INSERT INTO sign_in_history (id, account_id, user_id, login, ts, result, ip, device) VALUES (?, ?, ?, ?, ?, 'signed_in', '203.0.113.5', 'Chrome')");
  const t = Date.now() - 3600e3; for (let i = 0; i < 150; i++) ins.run('sh-' + i, me.account_id, me.id, me.login, t - i * 1000);
  let r = await app.req('GET', '/api/app/activity/me'); assert.equal(r.status, 200); assert.equal(r.data.history.length, 100); assert.equal(r.data.more, true); assert.ok(r.data.total >= 150);
  const last = r.data.history.at(-1).ts; r = await app.req('GET', `/api/app/activity/me?before=${last}`); assert.equal(r.data.total, undefined); assert.ok(r.data.history.length >= 50 && r.data.history.length < 100); assert.equal(r.data.more, false);
});
