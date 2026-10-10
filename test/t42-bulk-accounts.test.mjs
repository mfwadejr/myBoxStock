// TEST / t42-bulk-accounts — Host Accounts: bulk actions (preview, typed confirmation, audit, jobs), the Needs attention view and sortable columns.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, sleep } from './helpers.mjs';
import { canBulk } from '../src/routes/host/accounts-bulk.mjs';
import { plan, isDemo, toCsv, ACTIONS, LARGE_AT } from '../src/services/accounts/bulk.mjs';
import { sortRows } from '../src/services/accounts/list.mjs';
import { billingState } from '../src/services/billing/state.mjs';

const PW = 'Sup3rSecretPass!', DAY = 86400000;
let srv, host, raw, n = 0;
const A = (p, b, m = 'POST') => host.req(m, '/api/host/accounts' + p, b);
const jobNow = () => host.req('GET', '/api/host/accounts/bulk/job');
const bulk = (p, b) => host.req('POST', '/api/host/accounts/bulk' + p, b);
const q = (sql, ...p) => raw.prepare(sql).get(...p), all = (sql, ...p) => raw.prepare(sql).all(...p);

// A seeded account row; extra = { plan, trialDays (from now), users: [{email, verified, last_login}], recovery: 'none'|'unconfirmed'|'saved', created, name }
function seed(name, extra = {}) {
  n++; const id = 'seedacc' + String(n).padStart(4, '0'), code = 'seed-box-' + String(1000 + n), plan = extra.plan || 'trial', created = extra.created ?? Date.now() - 2 * DAY;
  const trialEnds = plan === 'trial' ? Date.now() + (extra.trialDays ?? 10) * DAY : null;
  raw.prepare('INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, trial_ends_at, plan_until, created_at, last_activity) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, code, name, `${code}@example.com`, 'active', plan, trialEnds, null, created, null);
  (extra.users || [{ last_login: Date.now() - DAY }]).forEach((u, i) => raw.prepare('INSERT INTO account_users (id, account_id, login, username, email, role, pw_hash, created_at, last_login, email_verified_at, totp_enabled) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(`${id}u${i}`, id, `${id}u${i}@${code}`, `u${i}`, u.email === undefined ? 'a@example.com' : u.email, i === 0 ? 'Administrator' : 'Standard', 'x', created, u.last_login ?? null, u.verified === false ? null : Date.now(), 1));
  if (extra.recovery) raw.prepare('INSERT INTO account_recovery (account_id, wrapped_adk, created_at, confirmed_at) VALUES (?,?,?,?)').run(id, 'w', created, extra.recovery === 'saved' ? Date.now() : null);
  return id;
}
const audit = async (event) => { for (let i = 0; i < 30; i++) { const rows = all('SELECT account_id, message, raw FROM event_log WHERE event = ?', event); if (rows.length) return rows; await sleep(150); } return []; };

test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  raw = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); raw.exec('PRAGMA busy_timeout = 8000');
});
test.after(() => { raw?.close(); srv?.stop(); });

test('the only actions are the four agreed ones and none is destructive', async () => {
  assert.deepEqual(ACTIONS, ['extend_trial', 'change_plan', 'announce', 'export']);
  const id = seed('Safe Boxes');
  for (const bad of ['suspend', 'close', 'delete', 'erase']) assert.equal((await bulk('/preview', { action: bad, params: {}, selection: { ids: [id] } })).data.code, 'BULK_BAD_ACTION');
  assert.equal((await bulk('/run', { action: 'delete', selection: { ids: [id] } })).data.code, 'BULK_BAD_ACTION');
});

test('Host administrators with the View role cannot use bulk actions', () => {
  assert.equal(canBulk({ role: 'View' }), false); assert.equal(canBulk({ role: 'view' }), false);
  assert.equal(canBulk({ role: 'Administrator' }), true); assert.equal(canBulk({ username: 'admin' }), true);
});

test('Needs attention combines the health problems, and says why', async () => {
  const clean = seed('Clean Co', { plan: 'free', recovery: 'saved' }), noKey = seed('NoKey Co', { plan: 'free', recovery: 'unconfirmed' }), unver = seed('Unverified Co', { plan: 'free', recovery: 'saved', users: [{ verified: false, last_login: Date.now() - DAY }] });
  const idle = seed('Idle Co', { plan: 'free', recovery: 'saved', created: Date.now() - 90 * DAY, users: [{ last_login: Date.now() - 60 * DAY }] }), ending = seed('Ending Co', { plan: 'trial', trialDays: 2, recovery: 'saved' }), far = seed('Far Co', { plan: 'trial', trialDays: 40, recovery: 'saved' });
  const late = seed('Late Co', { plan: 'free', recovery: 'saved' });
  raw.prepare("INSERT INTO support_tickets (id, number, source, account_id, subject, category, priority, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run('t-late', 9001, 'account', late, 'Help', 'Other', 'Normal', 'open', Date.now() - 20 * DAY, Date.now() - 20 * DAY);
  const rows = (await A('?health=attention&attentionDays=7', undefined, 'GET')).data, by = Object.fromEntries(rows.map(r => [r.business_name, r.attention]));
  assert.ok(!by['Clean Co'] && !by['Far Co']);
  assert.deepEqual(by['NoKey Co'], ['No recovery key']); assert.deepEqual(by['Unverified Co'], ['Email not verified']); assert.deepEqual(by['Idle Co'], ['Inactive 30 days']);
  assert.deepEqual(by['Ending Co'], ['Trial ending soon']); assert.deepEqual(by['Late Co'], ['Ticket overdue']);
  const wide = (await A('?health=attention&attentionDays=60', undefined, 'GET')).data.map(r => r.business_name); assert.ok(wide.includes('Far Co'), 'the trial window is chosen by the person');
  const narrow = (await A('?health=attention&attentionDays=1', undefined, 'GET')).data.map(r => r.business_name); assert.ok(!narrow.includes('Ending Co'));
  assert.ok(clean && noKey && unver && idle && ending && far);
});

test('columns sort by Business, Plan days left, Users and Last sign-in, both ways, with blanks last', async () => {
  const names = (r) => r.data.filter(x => /^Sort /.test(x.business_name)).map(x => x.business_name);
  seed('Sort B', { plan: 'trial', trialDays: 5, users: [{ last_login: Date.now() - 5 * DAY }, {}, {}] }); seed('Sort A', { plan: 'trial', trialDays: 20, users: [{ last_login: Date.now() - DAY }] }); seed('Sort C', { plan: 'free', users: [{ last_login: null }, {}] });
  assert.deepEqual(names(await A('?sort=business&dir=asc', undefined, 'GET')), ['Sort A', 'Sort B', 'Sort C']); assert.deepEqual(names(await A('?sort=business&dir=desc', undefined, 'GET')), ['Sort C', 'Sort B', 'Sort A']);
  assert.deepEqual(names(await A('?sort=days&dir=asc', undefined, 'GET')), ['Sort B', 'Sort A', 'Sort C'], 'no end date (Free) sorts last');
  assert.deepEqual(names(await A('?sort=days&dir=desc', undefined, 'GET')), ['Sort A', 'Sort B', 'Sort C']);
  assert.deepEqual(names(await A('?sort=users&dir=desc', undefined, 'GET')), ['Sort B', 'Sort C', 'Sort A']); assert.deepEqual(names(await A('?sort=users&dir=asc', undefined, 'GET')), ['Sort A', 'Sort C', 'Sort B']);
  assert.deepEqual(names(await A('?sort=last_login&dir=desc', undefined, 'GET')).slice(0, 2), ['Sort A', 'Sort B']); assert.equal(names(await A('?sort=last_login&dir=asc', undefined, 'GET')).at(-1), 'Sort C', 'never signed in sorts last');
  assert.equal(sortRows([{ business_name: 'b', billing: {}, user_count: 1 }], 'nonsense', 'asc').length, 1, 'an unknown sort key is ignored');
});

test('Extend trial: the preview says what will change, the typed confirmation is required, the dates move, every account is audited', async () => {
  const ids = [seed('Ext 1', { trialDays: 5 }), seed('Ext 2', { trialDays: 3 }), seed('Ext Free', { plan: 'free' })], before = ids.map(id => q('SELECT trial_ends_at AS t FROM accounts WHERE id = ?', id).t);
  const params = { days: 14 }, selection = { ids };
  let r = await bulk('/preview', { action: 'extend_trial', params, selection }); assert.equal(r.status, 200);
  assert.equal(r.data.text, 'This will extend 2 trials by 14 days.'); assert.equal(r.data.count, 2); assert.equal(r.data.selected, 3); assert.deepEqual(r.data.skipped, [{ reason: 'not on a running trial', count: 1 }]); assert.equal(r.data.confirm, 'EXTEND 2'); assert.equal(r.data.asJob, false);
  const run = (over) => bulk('/run', { action: 'extend_trial', params, selection, expect: 2, confirm: 'EXTEND 2', reason: 'Launch week', ...over });
  assert.equal((await run({ confirm: 'extend' })).data.code, 'BULK_CONFIRM'); assert.equal((await run({ confirm: '' })).data.code, 'BULK_CONFIRM');
  assert.equal((await run({ reason: '' })).data.code, 'BULK_REASON_REQUIRED'); assert.equal((await run({ expect: 3 })).data.code, 'BULK_CHANGED');
  assert.deepEqual(ids.map(id => q('SELECT trial_ends_at AS t FROM accounts WHERE id = ?', id).t), before, 'nothing changed until the confirmation was right');
  r = await run(); assert.equal(r.status, 200); assert.equal(r.data.result.done, 2); assert.equal(r.data.result.skipped, 1); assert.match(r.data.result.summary, /2 accounts done, 1 skipped/);
  const after = ids.map(id => q('SELECT trial_ends_at AS t FROM accounts WHERE id = ?', id).t);
  assert.equal(after[0] - before[0], 14 * DAY); assert.equal(after[1] - before[1], 14 * DAY); assert.equal(after[2], before[2], 'the Free account is untouched');
  const per = (await audit('bulk.extend_trial')).filter(x => ids.includes(x.account_id)); assert.equal(per.length, 2, 'one audit entry per account');
  assert.ok(per.every(x => /Trial extended by 14 days/.test(x.message) && JSON.parse(x.raw).data.reason === 'Launch week'));
  const sum = (await audit('bulk.summary')).filter(x => /Extend trial: 2 accounts done/.test(x.message)); assert.equal(sum.length, 1, 'one summary entry'); assert.equal(JSON.parse(sum[0].raw).actor, 'admin');
  const trail = (await host.req('GET', '/api/host/audit?type=bulk')).data.rows; assert.ok(trail.some(x => x.event === 'bulk.summary' && x.label === 'Bulk action summary')); assert.ok(trail.some(x => x.event === 'bulk.extend_trial' && x.label === 'Bulk action on an account'));
  assert.ok(!(await host.req('GET', '/api/host/audit?type=actions')).data.rows.some(x => /^bulk\./.test(x.event)), 'bulk entries have their own group');
  assert.ok(all('SELECT * FROM billing_events WHERE account_id = ? AND kind = ?', ids[0], 'trial_extended').length === 1, 'the plan history also records it');
});

test('a bad number is refused before anything happens', async () => {
  const id = seed('Bad Input');
  for (const days of [0, 400, 1.5, 'x']) assert.equal((await bulk('/preview', { action: 'extend_trial', params: { days }, selection: { ids: [id] } })).data.code, 'BULK_BAD_INPUT');
  assert.equal((await bulk('/preview', { action: 'extend_trial', params: { days: 5 }, selection: { ids: [] } })).data.code, 'BULK_NONE');
  assert.equal((await bulk('/preview', { action: 'change_plan', params: { plan: 'gold' }, selection: { ids: [id] } })).data.code, 'BULK_BAD_INPUT');
  assert.equal((await bulk('/preview', { action: 'change_plan', params: { plan: 'keep', note: '' }, selection: { ids: [id] } })).data.code, 'BULK_BAD_INPUT');
});

test('Change plan: preview text matches the change, plan notes and plan states change, history kept', async () => {
  const ids = [seed('Plan 1', { plan: 'trial' }), seed('Plan 2', { plan: 'trial' }), seed('Plan Free', { plan: 'free' })], selection = { ids };
  let r = await bulk('/preview', { action: 'change_plan', params: { plan: 'free', note: 'Launch partners' }, selection });
  assert.equal(r.data.text, 'This will change 2 accounts to Free.'); assert.deepEqual(r.data.skipped, [{ reason: 'already Free', count: 1 }]);
  r = await bulk('/run', { action: 'change_plan', params: { plan: 'free', note: 'Launch partners' }, selection, expect: 2, confirm: 'change 2', reason: 'Partner program' }); assert.equal(r.data.result.done, 2);
  assert.deepEqual(ids.map(id => q('SELECT plan FROM accounts WHERE id = ?', id).plan), ['free', 'free', 'free']); assert.equal(q('SELECT plan_note AS n FROM accounts WHERE id = ?', ids[0]).n, 'Launch partners');
  r = await bulk('/run', { action: 'change_plan', params: { plan: 'keep', note: 'Checked in October' }, selection: { ids: [ids[0]] }, expect: 1, confirm: 'CHANGE 1', reason: 'Tidy notes' }); assert.equal(r.data.result.done, 1);
  const a = q('SELECT plan, plan_note AS n FROM accounts WHERE id = ?', ids[0]); assert.equal(a.plan, 'free'); assert.equal(a.n, 'Checked in October');
  r = await bulk('/run', { action: 'change_plan', params: { plan: 'trial', days: 30 }, selection: { ids: [ids[1]] }, expect: 1, confirm: 'CHANGE 1', reason: 'Give another try' });
  assert.equal(Math.round((q('SELECT trial_ends_at AS t FROM accounts WHERE id = ?', ids[1]).t - Date.now()) / DAY), 30);
  assert.ok((await audit('bulk.change_plan')).filter(x => ids.includes(x.account_id)).length >= 4);
});

test('a large selection runs as a background job with progress, and still audits every account', async () => {
  const ids = Array.from({ length: LARGE_AT + 5 }, (_, i) => seed('Job ' + i, { trialDays: 4 })), before = q('SELECT trial_ends_at AS t FROM accounts WHERE id = ?', ids[0]).t;
  const pv = (await bulk('/preview', { action: 'extend_trial', params: { days: 7 }, selection: { ids } })).data; assert.equal(pv.asJob, true); assert.equal(pv.confirm, `EXTEND ${ids.length}`);
  const r = await bulk('/run', { action: 'extend_trial', params: { days: 7 }, selection: { ids }, expect: ids.length, confirm: pv.confirm, reason: 'Big batch' });
  assert.ok(r.data.job && r.data.job.status === 'running' || r.data.job?.status === 'done', 'started as a job'); assert.equal(r.data.job.total, ids.length);
  let job; for (let i = 0; i < 60; i++) { job = (await jobNow()).data.job; if (job?.status !== 'running') break; await sleep(150); }
  assert.equal(job.status, 'done'); assert.equal(job.ok, true); assert.equal(job.done, ids.length); assert.equal(job.pct, 100);
  assert.equal(q('SELECT trial_ends_at AS t FROM accounts WHERE id = ?', ids[0]).t - before, 7 * DAY);
  let seen = 0; for (let i = 0; i < 40 && seen < ids.length; i++) { seen = (await audit('bulk.extend_trial')).filter(x => ids.includes(x.account_id)).length; if (seen < ids.length) await sleep(150); }
  assert.equal(seen, ids.length);
  assert.ok((await bulk('/job/' + job.id + '/dismiss')).data.ok); assert.equal((await jobNow()).data.job, null);
});

test('Select all matching uses the same search and filter as the list', async () => {
  seed('Match Zed 1', { plan: 'free' }); seed('Match Zed 2', { plan: 'free' }); seed('Match Zed 3', { plan: 'trial' });
  const query = { q: 'match zed', plan: 'free' }, listed = (await A('?q=match%20zed&plan=free', undefined, 'GET')).data;
  const pv = (await bulk('/preview', { action: 'change_plan', params: { plan: 'paid', note: 'Moved to paid' }, selection: { all: true, query } })).data;
  assert.equal(listed.length, 2); assert.equal(pv.selected, 2); assert.equal(pv.count, 2);
});

test('Send announcement: shows to the chosen accounts only; email needs Email set up, has a cap, and skips owners without an address', async () => {
  const su = new Client(srv.base);
  let r = await su.req('POST', '/api/app/signup', { businessName: 'Notice Boxes', email: 'notice@example.com', username: 'nina', password: PW }); assert.equal(r.status, 200);
  await su.req('POST', '/api/app/login', { login: r.data.login, password: PW });
  const other = new Client(srv.base); r = await other.req('POST', '/api/app/signup', { businessName: 'Quiet Boxes', email: 'quiet@example.com', username: 'quin', password: PW }); await other.req('POST', '/api/app/login', { login: r.data.login, password: PW });
  const nid = (await A('?q=notice%20boxes', undefined, 'GET')).data[0].id, selection = { ids: [nid] };
  const params = { text: 'We are adding a new Support page next week.', level: 'warning', email: true };
  r = await bulk('/preview', { action: 'announce', params, selection }); assert.equal(r.data.text, 'This will show your notice to 1 account and email 1 owner.'); assert.equal(r.data.emailOff, true);
  const go = (p) => bulk('/run', { action: 'announce', params: p, selection, expect: 1, confirm: 'SEND 1', reason: 'Heads-up' });
  assert.equal((await go(params)).data.code, 'BULK_EMAIL_OFF', 'no email until Email is set up');
  assert.equal((await go({ ...params, text: 'x' })).data.code, 'BULK_BAD_INPUT');
  assert.equal((await go({ ...params, email: false })).data.result.done, 1);
  let me = (await su.req('GET', '/api/app/me')).data; assert.equal(me.announcement.text, params.text); assert.equal(me.announcement.level, 'warning');
  assert.equal((await other.req('GET', '/api/app/me')).data.announcement, null, 'other accounts see nothing'); assert.equal((await su.req('GET', '/api/app/announcement')).data.announcement.text, params.text);
  await host.req('PUT', '/api/host/mail', { enabled: true, mode: 'smtp', fromName: 'myBoxStock', fromAddress: 'no-reply@example.com', smtp: { host: '127.0.0.1', port: 587, secure: false, user: '', pass: '' } });
  assert.equal((await go(params)).data.result.emails, 1);
  const queued = (await host.req('GET', '/api/host/mail/queue')).data.queue.filter(m => m.to_addr === 'notice@example.com' && /message from myBoxStock/i.test(m.subject)); assert.equal(queued.length, 1);
  assert.ok(!(await host.req('GET', '/api/host/mail/queue')).data.queue.some(m => m.to_addr === 'quiet@example.com' && /message from myBoxStock/i.test(m.subject)), 'unselected accounts get nothing');
  assert.ok((await audit('bulk.announce')).length >= 2);
});

test('announcements never email Demo accounts, and accounts without an owner address are noted', () => {
  const mk = (o) => ({ id: o.id, owner_email: o.email, demo: o.demo, billing: billingState({ plan: 'free' }) });
  const t = [mk({ id: 'a', email: 'a@x.com' }), mk({ id: 'b', email: 'b@x.com', demo: 1 }), mk({ id: 'c', email: '' })];
  assert.equal(isDemo(t[1]), true); const pl = plan('announce', { text: 'Hello there', email: true }, t);
  assert.equal(pl.params.mails, 1); assert.equal(pl.applies.length, 3, 'Demo accounts can be selected and still get the in-app notice');
  assert.deepEqual(pl.skipped, { 'no owner email (notice only)': 1, 'Demo accounts never get email (notice only)': 1 });
});

test('Export list: Host-visible fields only, safe in a spreadsheet, logged for every account', async () => {
  const ids = [seed('=cmd|evil', { plan: 'free' }), seed('Quote "Co", Ltd', { plan: 'free' })];
  const r = await bulk('/export', { selection: { ids } }); assert.equal(r.status, 200); assert.match(r.data.filename, /^accounts-\d{4}-\d{2}-\d{2}\.csv$/); assert.equal(r.data.count, 2);
  const lines = r.data.csv.trim().split('\r\n'); assert.equal(lines[0], 'Business,Reseller ID,Owner email,Status,Plan,Plan ends,Days left,Users,Last sign-in,Created');
  assert.ok(lines[1].startsWith("'=cmd|evil,") || lines[2].startsWith("'=cmd|evil,"), 'a formula is neutralised'); assert.ok(r.data.csv.includes('"Quote ""Co"", Ltd"'));
  assert.ok(!/inventory|sale|customer|password|hash|secret/i.test(lines[0]), 'no business data columns');
  assert.equal((await audit('bulk.export')).filter(x => ids.includes(x.account_id)).length, 2);
  assert.ok(toCsv([]).startsWith('Business,'));
});

test('too many accounts at once is refused', async () => {
  const ids = Array.from({ length: 1001 }, (_, i) => 'nope' + i);
  assert.equal((await bulk('/preview', { action: 'export', params: {}, selection: { ids } })).data.code, 'BULK_TOO_MANY');
});
