// TEST / t38-demo-api — Demo mode on the Host, through the real server: off by default, the backup gate, Build / Stop / Remove / Reset as background jobs, the Host numbers and the
// show/hide filter, demo sign-ins and their permissions, the password actions and their audit trail, the Open ticket, and the promise that demo accounts never send email.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, sleep, allLogText, readJsonl } from './helpers.mjs';
import { totpCode } from '../src/auth/totp.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', HELPER = 'H3lperSecretPass!', PASS = 'a long backup passphrase', D = '/api/host/demo', JOBS = '/api/host/backups/jobs';
let srv, host, helper, real, realLogin;
const raw = () => { const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); return d; };
const sql = (q, a = []) => { const d = raw(); try { return d.prepare(q).all(...a); } finally { d.close(); } };
const current = async () => (await host.req('GET', `${JOBS}/current`)).data;
async function finish(id) { for (let i = 0; i < 3000; i++) { const j = (await current()).job; if (j && j.id === id && j.status !== 'running') return (await host.req('GET', `${JOBS}/${id}`)).data.job; await sleep(50); } throw new Error('job did not finish'); }
const dismiss = async () => { const j = (await current()).job; if (j) await host.req('POST', `${JOBS}/${j.id}/dismiss`); };
const OVERRIDE = { backupConfirm: 'PROCEED WITHOUT BACKUP' };
const events = () => readJsonl(srv.logDir, 'host').map(r => r.event);
const signIn = async (login, password, newPw) => { const c = new Client(srv.base); const r = await c.req('POST', '/api/host/login', { login, password }); assert.equal(r.status, 200); if (newPw) await c.req('POST', '/api/host/change-password', { current: password, next: newPw }); return c; };
const realSnapshot = () => JSON.stringify(sql('SELECT id, account_code, business_name, status FROM accounts WHERE demo = 0 ORDER BY id').concat(sql('SELECT a.id, COUNT(r.id) n FROM accounts a LEFT JOIN records r ON r.account_id = a.id WHERE a.demo = 0 GROUP BY a.id ORDER BY a.id')));

test.before(async () => {
  if (!sqlite) return;
  srv = await startServer();
  host = new Client(srv.base); await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
  await host.req('PUT', '/api/host/backups/full', { enabled: false, passphrase: PASS, keepDaily: 14, keepWeekly: 8 });
  assert.equal((await host.req('POST', '/api/host/admins', { username: 'helper', email: 'helper@example.com', password: 'Temp0rarySecret!' })).status, 200);
  helper = await signIn('helper', 'Temp0rarySecret!', HELPER);
  const setup = await helper.req('POST', '/api/host/totp/setup'); await helper.req('POST', '/api/host/totp/enable', { code: totpCode(setup.data.secret) });
  real = new Client(srv.base); const su = await real.req('POST', '/api/app/signup', { businessName: 'Real Boxes', email: 'real@example.com', username: 'rita', password: PW }); assert.equal(su.status, 200); realLogin = su.data.login;
  assert.equal((await real.req('POST', '/api/app/login', { login: realLogin, password: PW })).status, 200);
});
test.after(() => srv?.stop());
const T = { skip: !sqlite && 'SQLite-only', timeout: 180000 };

test('Demo mode is off by default, visible to every administrator, and nothing can be built until it is switched on', T, async () => {
  const v = (await host.req('GET', D)).data;
  assert.equal(v.enabled, false); assert.equal(v.canManage, true); assert.equal(v.isOwner, true); assert.deepEqual(v.sets.map(s => s.key), ['demo3', 'demo300', 'demo1000', 'demo5000']);
  assert.equal(v.realAccounts, 1); assert.equal(v.totals.accounts, 0); assert.ok(v.sets.every(s => s.estimate.accounts > 0 && s.defaults));
  assert.equal((await helper.req('GET', D)).data.canManage, true, 'an Administrator sees the page and may manage it');
  const r = await host.req('POST', `${D}/build`, { set: 'demo3' }); assert.equal(r.status, 409); assert.equal(r.data.code, 'DEMO_OFF');
  assert.equal((await host.req('POST', `${D}/build`, { set: 'nope' })).data.code, 'DEMO_SET_UNKNOWN');
  assert.equal((await new Client(srv.base).req('GET', D)).status, 401, 'not signed in');
});

test('the backup gate: no recent backup stops Build; only the Owner may continue without one, by typing the words; the choice is audited', T, async () => {
  assert.equal((await host.req('PUT', `${D}/enabled`, { enabled: true })).status, 200);
  assert.equal((await host.req('POST', `${D}/sets`, { name: 'Gatea', accounts: 2, devices: { min: 3, max: 8, big: 0 } })).status, 200);
  let r = await host.req('POST', `${D}/build`, { set: 'gatea' }); assert.equal(r.status, 409); assert.equal(r.data.code, 'DEMO_BACKUP_NEEDED'); assert.equal(r.data.state.recent, false);
  r = await helper.req('POST', `${D}/build`, { set: 'gatea', ...OVERRIDE }); assert.equal(r.status, 403); assert.equal(r.data.code, 'DEMO_OVERRIDE_OWNER');
  r = await host.req('POST', `${D}/build`, { set: 'gatea', backupConfirm: 'yes please' }); assert.equal(r.data.code, 'DEMO_BACKUP_CONFIRM');
  assert.equal(sql('SELECT COUNT(*) n FROM accounts WHERE demo = 1')[0].n, 0, 'every refusal changed nothing');
  const before = realSnapshot();
  r = await host.req('POST', `${D}/build`, { set: 'gatea', ...OVERRIDE }); assert.equal(r.status, 202, JSON.stringify(r.data));
  const j = await finish(r.data.job.id); assert.equal(j.status, 'done'); assert.equal(j.result.accounts, 2); assert.match(j.result.summary, /2 of 2 accounts built/);
  assert.equal(realSnapshot(), before, 'real accounts are unchanged by a Build'); await dismiss();
  assert.ok(events().includes('demo.backup_override')); assert.ok(events().includes('demo.build')); assert.ok(events().includes('demo.refused'));
  // a real full-site backup now satisfies the gate
  assert.equal((await host.req('POST', '/api/host/backups/full/run')).status, 200);
  const g = (await host.req('GET', `${D}/backup`)).data.backup; assert.equal(g.recent, true);
  assert.equal((await host.req('POST', `${D}/build`, { set: 'gatea' })).data.code, 'DEMO_ALREADY_BUILT');
  r = await host.req('POST', `${D}/remove`, { set: 'gatea', confirm: 'REMOVE' }); assert.equal(r.status, 202); const rm = await finish(r.data.job.id);
  assert.equal(rm.result.accounts, 2); assert.equal(rm.result.offerCompact, true, 'the result offers the Compact action'); await dismiss();
  assert.equal(sql('SELECT COUNT(*) n FROM accounts WHERE demo = 1')[0].n, 0);
});

test('Build Demo3: numbers, the DEMO chip data and filter, name clash refusal, and the Standard and View logins', T, async () => {
  const before = realSnapshot();
  let r = await host.req('POST', `${D}/estimate`, { key: 'demo3', recipe: { accounts: 3 } }); assert.equal(r.status, 200); assert.equal(r.data.estimate.accounts, 3); assert.equal(r.data.problem, null);
  r = await host.req('POST', `${D}/build`, { set: 'demo3' }); assert.equal(r.status, 202, JSON.stringify(r.data));
  assert.equal((await host.req('POST', `${D}/build`, { set: 'demo3' })).data.code, 'HOST_JOB_RUNNING', 'one job at a time');
  const j = await finish(r.data.job.id); assert.equal(j.status, 'done'); assert.equal(j.result.accounts, 3); assert.ok(j.result.records > 0); await dismiss();
  assert.equal(realSnapshot(), before);

  const dash = (await host.req('GET', '/api/host/dashboard')).data, hidden = (await host.req('GET', '/api/host/dashboard?demo=hide')).data;
  assert.equal(dash.accounts, 4); assert.equal(dash.demo.accounts, 3); assert.equal(hidden.accounts, 1); assert.equal(hidden.demoHidden, true); assert.ok(dash.users > hidden.users);
  const list = async (q = '') => { const d = (await host.req('GET', '/api/host/accounts' + q)).data; return Array.isArray(d) ? d : d.accounts || d.rows; };
  const all = await list(), noDemo = await list('?demo=hide');
  assert.equal(all.length, 4); assert.equal(all.filter(a => a.demo).length, 3); assert.equal(noDemo.length, 1); assert.equal(noDemo[0].demo, false);

  const logins = (await host.req('GET', `${D}/logins`)).data, d3 = logins.sets.find(s => s.key === 'demo3');
  assert.deepEqual(d3.logins.map(l => l.kind), ['owner', 'std', 'view', 'filler']); assert.ok(d3.logins.every(l => l.id), 'every row has an id'); assert.equal(JSON.stringify(logins).includes('pw_sealed'), false);
  const id = (k) => d3.logins.find(l => l.kind === k).id, pw = async (k) => (await host.req('POST', `${D}/logins/${id(k)}/show`)).data.password;
  const std = new Client(srv.base), view = new Client(srv.base), owner = new Client(srv.base);
  let x = await owner.req('POST', '/api/app/login', { login: 'demo3@demo3-001', password: await pw('owner') }); assert.equal(x.status, 200, JSON.stringify(x.data)); let me = (await owner.req('GET', '/api/app/me')).data.user; assert.equal(me.demo, true); assert.equal(me.role, 'Administrator');
  x = await std.req('POST', '/api/app/login', { login: 'demo3-std@demo3-001', password: await pw('std') }); assert.equal(x.status, 200); me = (await std.req('GET', '/api/app/me')).data.user; assert.equal(me.role, 'Standard'); assert.equal(me.demo, true);
  x = await view.req('POST', '/api/app/login', { login: 'demo3-view@demo3-001', password: await pw('view') }); assert.equal(x.status, 200); assert.equal((await view.req('GET', '/api/app/me')).data.user.role, 'View');
  assert.equal((await view.req('POST', '/api/app/vault/batch', { puts: [{ id: 'abcdefgh1', type: 'item', rev: 0, blob: 'v1.AAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA' }] })).status, 403, 'View cannot write');
  assert.equal((await view.req('GET', '/api/app/users')).status, 403); assert.equal((await std.req('GET', '/api/app/users')).status, 403, 'Standard cannot manage people');
  const recs = (await owner.req('GET', '/api/app/vault/records')).data; assert.ok(JSON.stringify(recs).length > 1000, 'the demo account holds records');
    assert.equal((await real.req('GET', '/api/app/me')).data.user.demo, false, 'a real login is not a demo login');

  // a real reseller whose name clashes makes a new set refuse
  assert.equal((await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Clasher', email: 'c@example.com', username: 'clasher', password: PW })).status, 200);
  const code = sql("SELECT account_code FROM accounts WHERE business_name = 'Clasher'")[0].account_code, prefix = code.split('-')[0];
  assert.ok(prefix); r = await host.req('POST', `${D}/sets`, { name: 'Demo3x', accounts: 2 }); assert.equal(r.status, 200);
  assert.equal((await host.req('POST', `${D}/estimate`, { key: 'demo3x' })).status, 200);
});

test('Show, Copy, Open and Reset password are role-restricted and audited, and a password never reaches a log', T, async () => {
  const d3 = (await host.req('GET', `${D}/logins`)).data.sets.find(s => s.key === 'demo3'), std = d3.logins.find(l => l.kind === 'std'), filler = d3.logins.find(l => l.kind === 'filler');
  const shown = (await host.req('POST', `${D}/logins/${std.id}/show`)).data.password, copied = (await host.req('POST', `${D}/logins/${std.id}/copy`)).data.password; assert.equal(shown, copied); assert.ok(shown.length >= 12);
  assert.equal((await host.req('POST', `${D}/logins/nope/show`)).data.code, 'DEMO_LOGIN_UNKNOWN');
  const ev = events(); assert.ok(ev.includes('demo.password_show')); assert.ok(ev.includes('demo.password_copy'));
  // reset: generated by anyone who may manage; chosen passwords only by the Owner
  let r = await helper.req('POST', `${D}/logins/${std.id}/reset`, { password: 'Helper-Chosen-Pass-1' }); assert.equal(r.status, 403); assert.equal(r.data.code, 'DEMO_OVERRIDE_OWNER');
  r = await helper.req('POST', `${D}/logins/${std.id}/reset`, {}); assert.equal(r.status, 200); const generated = r.data.password; assert.notEqual(generated, shown);
  r = await host.req('POST', `${D}/logins/${std.id}/reset`, { password: 'short1' }); assert.equal(r.data.code, 'DEMO_PASSWORD_BAD');
  const chosen = 'Owner-Chosen-Pass-77'; r = await host.req('POST', `${D}/logins/${std.id}/reset`, { password: chosen }); assert.equal(r.status, 200);
  assert.equal((await new Client(srv.base).req('POST', '/api/app/login', { login: 'demo3-std@demo3-001', password: shown })).status, 401, 'the old password stops working');
  assert.equal((await new Client(srv.base).req('POST', '/api/app/login', { login: 'demo3-std@demo3-001', password: chosen })).status, 200);
  assert.equal((await host.req('POST', `${D}/logins/${filler.id}/reset`, {})).status, 200); assert.ok(events().includes('demo.password_reset'));
  await sleep(300); const text = allLogText(srv.logDir);
  for (const p of [shown, generated, chosen]) assert.equal(text.includes(p), false, 'a demo password is never written to a log');
  // Open: a one-time ticket, redeemed by the sign-in page
  const o = (await host.req('POST', `${D}/logins/${std.id}/open`)).data; assert.match(o.url, /^\/app\/#\/demo\/[\w-]+$/); assert.ok(events().includes('demo.open'));
  const ticket = o.url.split('/').pop(), anon = new Client(srv.base);
  const t1 = await anon.req('POST', '/api/app/demo-open', { ticket }); assert.equal(t1.status, 200); assert.equal(t1.data.username, 'demo3-std'); assert.equal(t1.data.password, chosen);
  assert.equal((await anon.req('POST', '/api/app/demo-open', { ticket })).status, 400, 'a ticket works once');
  assert.equal((await host.req('POST', `${D}/logins/${filler.id}/open`)).data.code, 'DEMO_LOGIN_UNKNOWN', 'Open is for the named logins');
});

test('demo accounts never send email', T, async () => {
  const d = (await host.req('GET', '/api/host/accounts')).data, list = Array.isArray(d) ? d : d.accounts || d.rows, demoAcc = list.find(a => a.demo);
  const full = (await host.req('GET', `/api/host/accounts/${demoAcc.id}`)).data, u = (full.users || [])[0]; assert.ok(u, 'the demo account has people');
  let r = await host.req('POST', `/api/host/accounts/${demoAcc.id}/users/${u.id}/reset-link`, { reason: 'test' }); assert.equal(r.status, 400); assert.equal(r.data.code, 'DEMO_MAIL_BLOCKED');
  r = await host.req('POST', `/api/host/accounts/${demoAcc.id}/users/${u.id}/verify-resend`, {}); assert.equal(r.data.code, 'DEMO_MAIL_BLOCKED');
  await host.req('PUT', '/api/host/mail', { enabled: true, mode: 'smtp', fromName: 'Site', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', port: 1, secure: false, user: '', pass: '' } });
  const std = new Client(srv.base); const row = (await host.req('GET', `${D}/logins`)).data.sets.find(s => s.key === 'demo3').logins.find(l => l.kind === 'owner');
  await std.req('POST', '/api/app/login', { login: 'demo3@demo3-001', password: (await host.req('POST', `${D}/logins/${row.id}/show`)).data.password });
  r = await std.req('POST', '/api/app/receipt-email', { to: 'someone@example.com', receiptNo: '1', text: 'Thank you' }); assert.equal(r.status, 403); assert.equal(r.data.code, 'DEMO_MAIL_BLOCKED');
  assert.equal(sql("SELECT COUNT(*) n FROM mail_queue WHERE to_addr LIKE '%myboxstock.invalid'")[0].n, 0, 'nothing was queued for a demo address');
});

test('Stop ends a Build after the account it is on, leaving whole accounts; Reset demo rebuilds; Remove all takes only demo accounts', T, async () => {
  assert.equal((await host.req('POST', `${D}/sets`, { name: 'Slowset', accounts: 40, devices: { min: 20, max: 60, big: 0 } })).status, 200);
  const before = realSnapshot();
  let r = await host.req('POST', `${D}/build`, { set: 'slowset' }); assert.equal(r.status, 202); const id = r.data.job.id;
  assert.equal(r.data.job.stoppable, true);
  for (let i = 0; i < 400; i++) { const j = (await current()).job; if (j.pct > 0 || sql('SELECT COUNT(*) n FROM accounts WHERE demo_set = ?', ['slowset'])[0].n > 0) break; await sleep(10); }
  assert.equal((await host.req('POST', `${JOBS}/${id}/stop`)).status, 200);
  const j = await finish(id); assert.equal(j.status, 'done'); assert.equal(j.result.stopped, true); assert.ok(j.result.accounts < 40, 'it stopped early'); assert.match(j.result.summary, /^Stopped/);
  assert.ok(events().includes('demo.stopped')); await dismiss();
  // preview, then a typed confirmation
  const p = (await host.req('GET', `${D}/preview`)).data; assert.ok(p.accounts >= 3 + j.result.accounts);
  r = await host.req('POST', `${D}/remove`, { confirm: 'remove' }); assert.equal(r.data.code, 'DEMO_CONFIRM');
  r = await host.req('POST', `${D}/reset`, { set: 'demo3', confirm: 'REMOVE' }); assert.equal(r.data.code, 'DEMO_CONFIRM');
  r = await host.req('POST', `${D}/reset`, { set: 'demo3', confirm: 'RESET' }); assert.equal(r.status, 202, JSON.stringify(r.data)); const rs = await finish(r.data.job.id); assert.equal(rs.status, 'done'); assert.equal(rs.result.ok, true); await dismiss();
  assert.equal(sql("SELECT COUNT(*) n FROM accounts WHERE demo_set = 'demo3'")[0].n, 3, 'Demo3 was rebuilt');
  r = await host.req('POST', `${D}/remove`, { confirm: 'REMOVE' }); assert.equal(r.status, 202); const gone = await finish(r.data.job.id); assert.equal(gone.status, 'done'); await dismiss();
  assert.equal(sql('SELECT COUNT(*) n FROM accounts WHERE demo = 1')[0].n, 0); assert.equal(sql('SELECT COUNT(*) n FROM demo_logins')[0].n, 0);
  assert.equal(realSnapshot(), before, 'real accounts and their records are unchanged by Stop, Reset and Remove');
  assert.equal((await host.req('POST', `${D}/remove`, { confirm: 'REMOVE' })).data.code, 'DEMO_NOT_BUILT');
});

test('switching Demo mode off ends demo sign-ins; Reset to defaults restores the recipes', T, async () => {
  let r = await host.req('POST', `${D}/build`, { set: 'demo3' }); assert.equal(r.status, 202); await finish(r.data.job.id); await dismiss();
  const row = (await host.req('GET', `${D}/logins`)).data.sets.find(s => s.key === 'demo3').logins.find(l => l.kind === 'owner'), c = new Client(srv.base);
  assert.equal((await c.req('POST', '/api/app/login', { login: 'demo3@demo3-001', password: (await host.req('POST', `${D}/logins/${row.id}/show`)).data.password })).status, 200);
  assert.equal((await host.req('PUT', `${D}/enabled`, { enabled: false })).status, 200);
  assert.equal((await c.req('GET', '/api/app/vault/records')).status, 401, 'the open session was ended');
  r = await new Client(srv.base).req('POST', '/api/app/login', { login: 'demo3@demo3-001', password: (await host.req('POST', `${D}/logins/${row.id}/show`)).data.password }); assert.ok(r.status >= 400); assert.equal(r.data.code, 'DEMO_SIGNIN_OFF');
  assert.equal((await new Client(srv.base).req('POST', '/api/app/login', { login: realLogin, password: PW })).status, 200, 'real sign-ins are unaffected');
  assert.equal((await host.req('POST', `${D}/build`, { set: 'demo300' })).data.code, 'DEMO_OFF');
  await host.req('PUT', `${D}/sets/demo300`, { accounts: 77 }); assert.equal((await host.req('GET', D)).data.sets.find(s => s.key === 'demo300').accounts, 77);
  assert.equal((await host.req('POST', `${D}/sets/demo300/reset`)).data.set.accounts, 300);
  await host.req('PUT', `${D}/sets/demo300`, { accounts: 77 }); assert.equal((await host.req('POST', `${D}/reset-settings`)).status, 200);
  const v = (await host.req('GET', D)).data; assert.equal(v.sets.find(s => s.key === 'demo300').accounts, 300); assert.equal(v.sets.some(s => s.custom), false); assert.equal(v.enabled, false);
  assert.equal(sql("SELECT COUNT(*) n FROM accounts WHERE demo_set = 'demo3'")[0].n, 3, 'built accounts survive a settings reset');
  assert.ok(events().includes('demo.settings_reset'));
});
