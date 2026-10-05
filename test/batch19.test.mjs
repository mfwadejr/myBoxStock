// TEST / batch19 — Host alerts (grouped, emailed once), email health, update status, audit trail, onboarding funnel.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client } from './helpers.mjs';
import { isNewer } from '../src/services/updates/index.mjs';

const PW = 'Sup3rSecretPass!';
let srv, host, boss;
test.before(async () => {
  srv = await startServer({ TRUST_PROXY: '1' }); host = new Client(srv.base); boss = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  const me = (await host.req('GET', '/api/host/admins')).data[0];
  await host.req('PUT', `/api/host/admins/${me.id}`, { email: 'owner@example.com' });
});
test.after(() => srv?.stop());
const sql = async (q, a = []) => { const { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000'); try { return d.prepare(q).run(...a); } finally { d.close(); } };

test('alerts: a failing email queue raises one grouped alert, the Owner is emailed once, it clears when the problem is gone', async () => {
  assert.equal((await host.req('GET', '/api/host/alerts/count')).data.open, 0);
  await sql("INSERT INTO mail_queue (id,to_addr,subject,body_text,body_html,status,attempts,last_error,created_at) VALUES ('f1','x@example.com','S','t','h','failed',5,'Connection refused',?)", [Date.now()]);
  let d = (await host.req('POST', '/api/host/alerts/check')).data; assert.equal(d.open.length, 1); assert.equal(d.open[0].kind, 'email.failing'); assert.match(d.open[0].detail, /Connection refused/);
  d = (await host.req('POST', '/api/host/alerts/check')).data; assert.equal(d.open.length, 1, 'still one alert'); assert.equal(d.open[0].occurrences, 2, 'repeats are counted, not listed again');
  const q = (await host.req('GET', '/api/host/mail/queue')).data.queue.filter(m => /myBoxStock alert/.test(m.subject) && m.to_addr === 'owner@example.com'); assert.equal(q.length, 1, 'one email to the Owner, not one per repeat');
  assert.equal((await host.req('GET', '/api/host/alerts/count')).data.open, 1);
  await sql("DELETE FROM mail_queue WHERE id = 'f1'");
  d = (await host.req('POST', '/api/host/alerts/check')).data; assert.equal(d.open.length, 0, 'cleared by itself'); assert.equal(d.recent.length, 1);
});

test('alerts: a set-aside alert is hidden from the count and stays quiet while the problem lasts', async () => {
  await sql("INSERT INTO mail_queue (id,to_addr,subject,body_text,body_html,status,attempts,last_error,created_at) VALUES ('f2','x@example.com','S','t','h','failed',5,'Timeout',?)", [Date.now()]);
  const d = (await host.req('POST', '/api/host/alerts/check')).data; assert.equal(d.open.length, 1);
  assert.equal((await host.req('POST', `/api/host/alerts/${d.open[0].id}/dismiss`)).status, 200);
  const after = (await host.req('POST', '/api/host/alerts/check')).data; assert.equal(after.open.length, 0); assert.equal(after.quiet.length, 1, 'no new alert and no new email while set aside');
  assert.equal((await host.req('GET', '/api/host/alerts/count')).data.open, 0);
  assert.equal((await host.req('GET', '/api/host/mail/queue')).data.queue.filter(m => /myBoxStock alert/.test(m.subject)).length, 2, 'only the first alert of each problem was emailed');
  await sql("DELETE FROM mail_queue WHERE id = 'f2'");
});

test('alerts: many failed sign-ins and trials about to end are noticed', async () => {
  const now = Date.now(); for (let i = 0; i < 22; i++) await sql("INSERT INTO event_log (id,ts,level,area,event,actor,message,raw) VALUES (?,?,?,?,?,?,?,?)", [`e${i}`, now - i * 1000, 'warn', 'auth', 'login.failed', 'x', 'Failed sign-in', '{}']);
  const r = await boss.req('POST', '/api/app/signup', { businessName: 'Soon Co', email: 'soon@example.com', username: 'sue', password: PW }); assert.equal(r.status, 200);
  await sql("UPDATE accounts SET plan = 'trial', trial_ends_at = ?", [now + 2 * 86400e3]);
  const kinds = (await host.req('POST', '/api/host/alerts/check')).data.open.map(a => a.kind).sort();
  assert.deepEqual(kinds, ['signins.failing', 'trials.ending']);
});

test('email health: last send, failures, queue size', async () => {
  let h = (await host.req('GET', '/api/host/mail/health')).data; assert.equal(h.failed24h, 0); assert.ok('queued' in h && 'lastSentAt' in h);
  await sql("INSERT INTO mail_queue (id,to_addr,subject,body_text,body_html,status,attempts,last_error,created_at,sent_at) VALUES ('s1','a@example.com','S','t','h','sent',1,NULL,?,?)", [Date.now(), Date.now()]);
  await sql("INSERT INTO mail_queue (id,to_addr,subject,body_text,body_html,status,attempts,last_error,created_at) VALUES ('f3','a@example.com','S','t','h','failed',5,'550 mailbox unavailable',?)", [Date.now()]);
  h = (await host.req('GET', '/api/host/mail/health')).data; assert.ok(h.lastSentAt > 0); assert.equal(h.failed24h, 1); assert.equal(h.lastError, '550 mailbox unavailable'); assert.ok(h.sent24h >= 1);
});

test('updates: version and last-update info, version comparison, release address is checked', async () => {
  assert.equal(isNewer('0.19.1', '0.19.0'), true); assert.equal(isNewer('v0.20.0', '0.19.9'), true); assert.equal(isNewer('0.19.0', '0.19.0'), false); assert.equal(isNewer('0.18.2', '0.19.0'), false);
  let s = (await host.req('GET', '/api/host/updates')).data; assert.match(s.version, /^\d+\.\d+\.\d+$/); assert.equal(s.check.configured, false); assert.equal(s.lastUpdate, null);
  assert.equal((await host.req('PUT', '/api/host/updates', { url: 'http://insecure.example.com/x' })).status, 400, 'https only');
  assert.equal((await host.req('POST', '/api/host/updates/check')).status, 400, 'nothing to check yet');
  s = (await host.req('PUT', '/api/host/updates', { url: 'https://127.0.0.1:1/latest' })).data; assert.equal(s.check.configured, true);
  s = (await host.req('POST', '/api/host/updates/check')).data; assert.ok(s.check.error, 'an unreachable address is reported, not crashed on'); assert.ok(s.check.checkedAt);
  s = (await host.req('PUT', '/api/host/updates', { url: '' })).data; assert.equal(s.check.configured, false);
});

test('audit trail: Host administrator actions are searchable, and only actions', async () => {
  await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'Audit me', level: 'info', until: '' });
  let d; for (let i = 0; i < 20; i++) { d = (await host.req('GET', '/api/host/audit?q=announcement')).data; if (d.rows.length) break; await new Promise(r => setTimeout(r, 250)); } // log rows are written a moment after the action
  assert.ok(d.rows.length >= 1); assert.ok(d.rows.every(r => r.actor === 'admin'));
  assert.ok((await host.req('GET', '/api/host/audit/actors')).data.includes('admin'));
  assert.equal((await host.req('GET', '/api/host/audit?actor=nobody')).data.rows.length, 0);
  assert.equal((await new Client(srv.base).req('GET', '/api/host/audit')).status, 401);
});

test('onboarding funnel: counts each setup step and shows where an account stopped', async () => {
  const d = (await host.req('GET', '/api/host/onboarding?days=30')).data;
  assert.equal(d.total, 1); assert.deepEqual(d.funnel.map(s => s.key), ['created', 'emailConfirmed', 'firstSignIn', 'recoverySaved', 'planStarted']);
  assert.equal(d.funnel[0].count, 1); assert.equal(d.funnel[4].count, 1, 'a trial counts as a plan started'); assert.equal(d.accounts[0].steps.recoverySaved, false); assert.ok(d.accounts[0].stuckAt);
  assert.equal((await host.req('GET', '/api/host/onboarding?days=0')).status, 200);
});
