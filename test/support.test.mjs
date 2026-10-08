// TEST / support — internal support tickets: open, reply, internal notes hidden from the reseller, who sees which tickets, statuses and auto-close,
// the overdue alert, screenshot limits, the Owner-only purge, the audit trail, the Host settings and the Host notes.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';
import { totpCode } from '../src/auth/totp.mjs';

const PW = 'Sup3rSecretPass!', USERPW = 'Usr-pass-12345', HELPER = 'H3lperSecretPass!';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from('JFIF'), Buffer.alloc(40)]);
let srv, host, helper, admin, std, std2, view, other, acc, db;

const upload = async (c, base, bytes, name = 'shot.png') => {
  const res = await fetch(`${srv.base}${base}/upload?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Cookie: Object.entries(c.jar).map(([k, v]) => `${k}=${v}`).join('; '), 'X-CSRF-Token': c.csrf }, body: bytes });
  let data = {}; try { data = await res.json(); } catch {} return { status: res.status, data };
};
const raw = async (c, url) => fetch(srv.base + url, { headers: { Cookie: Object.entries(c.jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
const sql = (q, args = []) => db.prepare(q).run(...args);
const get = (q, args = []) => db.prepare(q).get(...args);
const app = (c, m, p, b) => c.req(m, '/api/app/support' + p, b), hs = (m, p, b, c = host) => c.req(m, '/api/host/support' + p, b);
const newUser = async (role, name) => {
  const a = await admin.req('POST', '/api/app/users', { username: name, role, password: USERPW }); assert.equal(a.status, 200);
  const c = new Client(srv.base); let r = await c.req('POST', '/api/app/login', { login: a.data.login, password: USERPW }); assert.equal(r.data.mustChange, true);
  r = await c.req('POST', '/api/app/change-password', { current: USERPW, next: USERPW + 'x' }); assert.equal(r.status, 200); return c;
};

test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 50000, windowSec: 60, authMaxAttempts: 5000, authWindowSec: 60, banAfterViolations: 500, banMinutes: 1 });
  await host.req('POST', '/api/host/admins', { username: 'helper', email: 'helper@example.com', password: 'Temp0rarySecret!' });
  helper = new Client(srv.base); await helper.req('POST', '/api/host/login', { login: 'helper', password: 'Temp0rarySecret!' }); await helper.req('POST', '/api/host/change-password', { current: 'Temp0rarySecret!', next: HELPER });
  const setup = await helper.req('POST', '/api/host/totp/setup'); await helper.req('POST', '/api/host/totp/enable', { code: totpCode(setup.data.secret) });
  admin = new Client(srv.base); await admin.req('POST', '/api/app/signup', { businessName: 'Alpha Shop', email: 'alpha@example.com', username: 'alpha', password: PW });
  const login = (await host.req('GET', '/api/host/accounts')).data[0]; acc = login;
  await admin.req('POST', '/api/app/login', { login: `alpha@${acc.account_code}`, password: PW });
  std = await newUser('Standard', 'stan'); std2 = await newUser('Standard', 'sue'); view = await newUser('View', 'vic');
  other = new Client(srv.base); const o = await other.req('POST', '/api/app/signup', { businessName: 'Beta Shop', email: 'beta@example.com', username: 'beta', password: PW });
  await other.req('POST', '/api/app/login', { login: o.data.login, password: PW });
  const { DatabaseSync } = await import('node:sqlite'); db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); db.exec('PRAGMA busy_timeout = 5000');
});
test.after(() => { try { db?.close(); } catch {} srv?.stop(); });

test('signed-in only: the Support API refuses visitors on both sides', async () => {
  const anon = new Client(srv.base);
  assert.equal((await anon.req('GET', '/api/app/support/tickets')).status, 401); assert.equal((await anon.req('POST', '/api/app/support/tickets', {})).status, 401);
  assert.equal((await anon.req('GET', '/api/host/support/tickets')).status, 401); assert.equal((await admin.req('GET', '/api/host/support/tickets')).status, 401, 'a reseller session is not a Host session');
  assert.equal((await host.req('GET', '/api/app/support/tickets')).status, 401, 'and the Host session is not a reseller session');
});

test('a reseller opens a ticket; the Host sees it with the requester panel', async () => {
  let r = await app(std, 'POST', '/tickets', { category: 'Problem', subject: 'Scanner will not focus', message: 'It blurs on my phone. Serial is not included.' }); assert.equal(r.status, 200);
  assert.match(r.data.ticket.label, /^T-\d+$/); assert.equal(r.data.ticket.number, 1001);
  const no = r.data.ticket.number;
  const list = (await hs('GET', '/tickets')).data; assert.equal(list.total, 1); const t = list.tickets[0];
  assert.deepEqual([t.label, t.status, t.priority, t.category, t.requester, t.accountCode], ['T-1001', 'open', 'Normal', 'Problem', 'stan', acc.account_code]);
  const d = (await hs('GET', `/tickets/${no}`)).data;
  assert.equal(d.requester.account.name, 'Alpha Shop'); assert.equal(d.requester.account.code, acc.account_code); assert.equal(d.requester.person.username, 'stan'); assert.equal(d.requester.person.role, 'Standard');
  assert.ok(d.requester.appVersion && d.requester.device); assert.equal(d.requester.account.status, 'active'); assert.equal(d.requester.account.plan, 'trial'); assert.equal(d.messages.length, 1);
  assert.equal(d.options.canned.length >= 1, true); assert.ok(d.options.staff.some(s => s.username === 'admin'));
  // validation and the catalog codes
  for (const [body, code] of [[{ category: 'Nope', subject: 'Hello there', message: 'Long enough message' }, 'SUPPORT_CATEGORY_BAD'], [{ category: 'Problem', subject: 'x', message: 'Long enough message' }, 'SUPPORT_SUBJECT_BAD'], [{ category: 'Problem', subject: 'Hello there', message: 'hi' }, 'SUPPORT_MESSAGE_BAD']]) {
    r = await app(std, 'POST', '/tickets', body); assert.equal(r.status, 400); assert.equal(r.data.code, code); assert.ok(r.data.error.endsWith('.'));
  }
  assert.equal((await app(std, 'GET', '/tickets/9999')).status, 404);
});

test('replies, the unread badge, and an internal note the reseller never sees', async () => {
  const no = 1001;
  assert.equal((await app(std, 'GET', '/unread')).data.n, 0);
  let r = await hs('POST', `/tickets/${no}/reply`, { message: 'INTERNAL-ONLY: customer is on a trial, be kind.', internal: true }); assert.equal(r.status, 200); assert.equal(r.data.internal, true);
  assert.equal((await app(std, 'GET', '/unread')).data.n, 0, 'a note does not alert the reseller');
  r = await hs('POST', `/tickets/${no}/reply`, { message: 'Try cleaning the lens, then scan again.' }); assert.equal(r.status, 200); assert.equal(r.data.status, 'waiting_reseller');
  assert.equal(r.data.email.sent, false); assert.match(r.data.email.why, /Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway\./);
  assert.equal((await app(std, 'GET', '/unread')).data.n, 1);
  const list = (await app(std, 'GET', '/tickets')).data.tickets; assert.equal(list[0].unread, true); assert.equal(list[0].statusLabel, 'Waiting on you');
  const d = (await app(std, 'GET', `/tickets/${no}`)).data;
  assert.equal(d.messages.filter(m => m.who === 'team').length, 1); assert.equal(d.messages.find(m => m.who === 'team').author, 'myBoxStock support');
  assert.ok(!JSON.stringify(d).includes('INTERNAL-ONLY'), 'the internal note never reaches the reseller'); assert.ok(!JSON.stringify(d).includes('Assigned to'), 'neither do Host-only log lines');
  assert.equal((await app(std, 'GET', '/unread')).data.n, 0, 'reading it clears the badge');
  // the Host sees the note and the log line
  const hd = (await hs('GET', `/tickets/${no}`)).data; assert.ok(hd.messages.some(m => m.internal && m.body.startsWith('INTERNAL-ONLY'))); assert.ok(hd.messages.some(m => m.side === 'system' && /Assigned to admin/.test(m.body)), 'replying took the ticket');
  assert.equal(hd.ticket.assignee, 'admin'); assert.equal(hd.messages.find(m => m.side === 'host' && !m.internal).author, 'admin', 'the Host sees the real name');
  // the reseller answers: back to Open
  r = await app(std, 'POST', `/tickets/${no}/messages`, { message: 'Cleaned it, still blurry.' }); assert.equal(r.status, 200); assert.equal(r.data.status, 'open');
  assert.equal((await hs('GET', `/tickets/${no}`)).data.ticket.status, 'open');
});

test('who sees which tickets: own for Standard and View, everything for Administrators, never another account', async () => {
  let r = await app(view, 'POST', '/tickets', { category: 'Question', subject: 'Can a viewer export?', message: 'A question from a View user.' }); assert.equal(r.status, 200, 'View users may open tickets');
  r = await app(std2, 'POST', '/tickets', { category: 'Billing', subject: 'Invoice question', message: 'A question from Sue.' }); assert.equal(r.status, 200);
  const nums = async (c) => (await app(c, 'GET', '/tickets')).data.tickets.map(t => t.number).sort();
  assert.deepEqual(await nums(std), [1001]); assert.deepEqual(await nums(view), [1002]); assert.deepEqual(await nums(std2), [1003]); assert.deepEqual(await nums(admin), [1001, 1002, 1003]);
  assert.equal((await app(std, 'GET', '/tickets/1003')).status, 404); assert.equal((await app(view, 'GET', '/tickets/1001')).status, 404); assert.equal((await app(std, 'POST', '/tickets/1003/messages', { message: 'sneaky' })).status, 404);
  assert.equal((await app(admin, 'GET', '/tickets/1003')).status, 200); assert.equal((await app(admin, 'GET', '/tickets/1003')).data.ticket.own, false);
  assert.deepEqual(await nums(other), []); assert.equal((await app(other, 'GET', '/tickets/1001')).status, 404);
  assert.equal((await app(other, 'POST', '/tickets', { category: 'Question', subject: 'Beta question', message: 'From another account.' })).data.ticket.number, 1004);
  assert.deepEqual(await nums(admin), [1001, 1002, 1003], 'another account\'s ticket never shows');
  // Host: the other tickets of the account are listed in the requester panel
  const d = (await hs('GET', '/tickets/1001')).data; assert.deepEqual(d.requester.others.map(o => o.number).sort(), [1002, 1003]);
  // the Administrator's badge counts replies to other people's tickets too
  await hs('POST', '/tickets/1003/reply', { message: 'Answer for Sue.' }); assert.equal((await app(admin, 'GET', '/unread')).data.n, 2, 'both replies, to Stan and to Sue'); assert.equal((await app(std, 'GET', '/unread')).data.n, 0); assert.equal((await app(std2, 'GET', '/unread')).data.n, 1);
});

test('statuses: the Host changes them, a reseller reply reopens Resolved, Closed takes no replies, Resolved closes by itself', async () => {
  let r = await hs('PATCH', '/tickets/1001', { status: 'resolved' }); assert.equal(r.status, 200); assert.deepEqual(r.data.changed, ['status']);
  let d = (await hs('GET', '/tickets/1001')).data; assert.equal(d.ticket.status, 'resolved'); assert.ok(d.ticket.resolvedAt);
  assert.ok((await app(std, 'GET', '/tickets/1001')).data.messages.some(m => m.who === 'system' && /Status changed to Resolved/.test(m.body)), 'status lines are visible to the reseller');
  r = await app(std, 'POST', '/tickets/1001/messages', { message: 'It broke again after the update.' }); assert.equal(r.data.reopened, true); assert.equal(r.data.status, 'open');
  assert.equal((await hs('GET', '/tickets/1001')).data.ticket.resolvedAt, null);
  assert.equal((await hs('PATCH', '/tickets/1001', { status: 'bogus' })).data.code, 'SUPPORT_STATUS_BAD');
  await hs('PATCH', '/tickets/1001', { status: 'waiting_host' }); r = await app(std, 'POST', '/tickets/1001/messages', { message: 'Any news?' }); assert.equal(r.data.status, 'waiting_host', 'Waiting on Host stays that way');
  // auto-close: Resolved for longer than the number of days closes at the next check
  await hs('PATCH', '/tickets/1002', { status: 'resolved' }); sql('UPDATE support_tickets SET resolved_at = ? WHERE number = 1002', [Date.now() - 8 * 86400e3]);
  await hs('PATCH', '/tickets/1003', { status: 'resolved' }); sql('UPDATE support_tickets SET resolved_at = ? WHERE number = 1003', [Date.now() - 3 * 86400e3]);
  await host.req('POST', '/api/host/alerts/check');
  assert.equal(get('SELECT status FROM support_tickets WHERE number = 1002').status, 'closed', 'resolved 8 days ago, closed'); assert.equal(get('SELECT status FROM support_tickets WHERE number = 1003').status, 'resolved', 'resolved 3 days ago stays');
  r = await app(view, 'POST', '/tickets/1002/messages', { message: 'One more thing.' }); assert.equal(r.status, 409); assert.equal(r.data.code, 'SUPPORT_CLOSED');
  assert.equal((await app(view, 'GET', '/tickets/1002')).data.canReply, false);
  assert.ok((await hs('GET', '/tickets/1002')).data.messages.some(m => /Closed automatically after 7 days/.test(m.body)));
  // the number of days is a Host setting
  assert.equal((await hs('PUT', '/settings', { autoCloseDays: 2 })).status, 200); await host.req('POST', '/api/host/alerts/check'); assert.equal(get('SELECT status FROM support_tickets WHERE number = 1003').status, 'closed', 'after 2 days it closes too');
  await hs('PUT', '/settings', { autoCloseDays: 7 });
  // priority, category, assignee
  assert.deepEqual((await hs('PATCH', '/tickets/1001', { priority: 'Urgent', category: 'Account', assignee: (await hs('GET', '/staff')).data.find(s => s.username === 'helper').id })).data.changed, ['priority', 'category', 'assignee']);
  d = (await hs('GET', '/tickets/1001')).data; assert.deepEqual([d.ticket.priority, d.ticket.category, d.ticket.assignee], ['Urgent', 'Account', 'helper']);
  assert.equal((await hs('PATCH', '/tickets/1001', { priority: 'Cosmic' })).data.code, 'SUPPORT_PRIORITY_BAD'); assert.equal((await hs('PATCH', '/tickets/1001', { assignee: 'nobody-here' })).data.code, 'SUPPORT_ASSIGNEE_BAD');
  assert.ok(!JSON.stringify((await app(std, 'GET', '/tickets/1001')).data).includes('Urgent'), 'priority and assignee stay Host-only');
});

test('the Host list: filters, search and the response-target clock (business days)', async () => {
  const q = async (qs) => (await hs('GET', '/tickets?' + qs)).data.tickets.map(t => t.number).sort();
  assert.deepEqual(await q('status=all'), [1001, 1002, 1003, 1004]); assert.deepEqual(await q('status=closed'), [1002, 1003]); assert.deepEqual(await q(''), [1001, 1004], 'the default is the active tickets');
  assert.deepEqual(await q('status=all&priority=Urgent'), [1001]); assert.deepEqual(await q('status=all&category=Billing'), [1003]); assert.deepEqual(await q('status=all&assignee=none'), [1002, 1004].filter(n => n !== 1002).concat([]).length ? await q('status=all&assignee=none') : []);
  assert.deepEqual(await q('status=all&q=T-1004'), [1004]); assert.deepEqual(await q('status=all&q=invoice'), [1003]); assert.deepEqual(await q('status=all&q=blurry'), [1001], 'search reads the messages');
  assert.deepEqual(await q('status=all&q=beta+shop'), [1004]); assert.deepEqual(await q('status=all&q=stan'), [1001]);
  // overdue: nothing yet; then the newest awaiting ticket is made old
  assert.deepEqual(await q('status=overdue'), []);
  sql("UPDATE support_tickets SET status = 'open', last_requester_at = ?, created_at = ? WHERE number = 1004", [Date.now() - 10 * 86400e3, Date.now() - 10 * 86400e3]);
  assert.deepEqual(await q('status=overdue'), [1004]); const sum = (await hs('GET', '/summary')).data; assert.equal(sum.overdue, 1); assert.ok(sum.open >= 2);
  assert.equal((await host.req('GET', '/api/host/dashboard')).data.support.overdue, 1, 'the Overview carries the open-ticket count');
  assert.equal((await hs('GET', '/tickets?status=active&q=nothing-matches-this')).data.total, 0);
});

test('overdue Alert: raised once past the response target, cleared when the ticket is answered', async () => {
  await host.req('POST', '/api/host/alerts/check'); let a = (await host.req('GET', '/api/host/alerts')).data.open.filter(x => x.kind === 'support.overdue');
  assert.equal(a.length, 1); assert.match(a[0].detail, /T-1004/); assert.match(a[0].detail, /response target of 2 business days/);
  await host.req('POST', '/api/host/alerts/check'); a = (await host.req('GET', '/api/host/alerts')).data.open.filter(x => x.kind === 'support.overdue'); assert.equal(a.length, 1, 'grouped: one line with a counter'); assert.ok(a[0].occurrences >= 2);
  assert.equal((await hs('PUT', '/settings', { responseDays: 30 })).status, 200); await host.req('POST', '/api/host/alerts/check');
  assert.equal((await host.req('GET', '/api/host/alerts')).data.open.filter(x => x.kind === 'support.overdue').length, 0, 'a longer target clears it'); await hs('PUT', '/settings', { responseDays: 2 });
  await host.req('POST', '/api/host/alerts/check'); assert.equal((await host.req('GET', '/api/host/alerts')).data.open.filter(x => x.kind === 'support.overdue').length, 1);
  await hs('POST', '/tickets/1004/reply', { message: 'Sorry for the wait.' }); await host.req('POST', '/api/host/alerts/check');
  assert.equal((await host.req('GET', '/api/host/alerts')).data.open.filter(x => x.kind === 'support.overdue').length, 0, 'answering clears it');
});

test('screenshots: PNG or JPG only (checked by the first bytes), size and count caps, kept apart per ticket and per side', async () => {
  let r = await upload(std, '/api/app/support', PNG, 'my screen.png'); assert.equal(r.status, 200); assert.equal(r.data.mime, 'image/png'); assert.equal(r.data.name, 'my screen.png');
  const gif = Buffer.from('GIF89a' + 'x'.repeat(50)), txt = Buffer.from('not a picture at all, just text pretending');
  r = await upload(std, '/api/app/support', gif, 'x.png'); assert.equal(r.status, 415); assert.equal(r.data.code, 'SUPPORT_ATTACH_TYPE');
  r = await upload(std, '/api/app/support', txt, 'evil.jpg'); assert.equal(r.status, 415, 'the name does not matter, the bytes do');
  r = await upload(std, '/api/app/support', Buffer.from('<svg onload=alert(1)></svg>'), 'x.svg'); assert.equal(r.status, 415);
  r = await upload(std, '/api/app/support', Buffer.alloc(0)); assert.equal(r.status, 400); assert.equal(r.data.code, 'SUPPORT_ATTACH_EMPTY');
  r = await upload(std, '/api/app/support', Buffer.concat([PNG, Buffer.alloc(1100 * 1024)])); assert.equal(r.status, 413); assert.equal(r.data.code, 'SUPPORT_ATTACH_BIG');
  const j = await upload(std, '/api/app/support', JPG, '../../etc/passwd.jpg'); assert.equal(j.status, 200); assert.equal(j.data.name, 'passwd.jpg', 'path pieces are dropped');
  const k = await upload(std, '/api/app/support', PNG, 'third.png'); assert.equal(k.status, 200);
  r = await upload(std, '/api/app/support', PNG, 'fourth.png'); assert.equal(r.status, 409); assert.equal(r.data.code, 'SUPPORT_ATTACH_COUNT');
  // the first upload id is the one from before; send a ticket with all three
  const pend = db.prepare('SELECT id FROM support_attachments WHERE ticket_id IS NULL AND owner_id = (SELECT id FROM account_users WHERE username = ?)').all('stan').map(x => x.id); assert.equal(pend.length, 3);
  r = await app(std, 'POST', '/tickets', { category: 'Question', subject: 'With pictures', message: 'Three screenshots attached.', attachmentIds: pend, diagnostics: true }); assert.equal(r.status, 200); const no = r.data.ticket.number;
  const d = (await app(std, 'GET', `/tickets/${no}`)).data, att = d.messages[0].attachments; assert.equal(att.length, 3); assert.match(d.messages[0].diagnostics, /myBoxStock diagnostics/); assert.match(d.messages[0].diagnostics, /App version/);
  // served as the right type, locked down
  const pic = await raw(std, `/api/app/support/attachments/${att[0].id}`); assert.equal(pic.status, 200); assert.equal(pic.headers.get('content-type'), 'image/png'); assert.equal(pic.headers.get('x-content-type-options'), 'nosniff'); assert.match(pic.headers.get('content-security-policy'), /sandbox/);
  assert.deepEqual(Buffer.from(await pic.arrayBuffer()), PNG, 'stored byte for byte');
  assert.equal((await raw(std2, `/api/app/support/attachments/${att[0].id}`)).status, 404, 'a colleague without access cannot fetch it'); assert.equal((await raw(admin, `/api/app/support/attachments/${att[0].id}`)).status, 200); assert.equal((await raw(other, `/api/app/support/attachments/${att[0].id}`)).status, 404);
  assert.equal((await raw(host, `/api/host/support/attachments/${att[0].id}`)).status, 200); assert.equal((await raw(std, `/api/host/support/attachments/${att[0].id}`)).status, 401);
  // reusing a sent upload, or someone else's, is refused
  r = await app(std, 'POST', `/tickets/${no}/messages`, { message: 'Again with the same picture.', attachmentIds: [att[0].id] }); assert.equal(r.data.code, 'SUPPORT_ATTACH_GONE');
  // a Host screenshot on an internal note stays Host-only
  const hu = await upload(host, '/api/host/support', PNG, 'internal.png'); assert.equal(hu.status, 200);
  assert.equal((await hs('POST', `/tickets/${no}/reply`, { message: 'Internal screenshot.', internal: true, attachmentIds: [hu.data.id] })).status, 200);
  assert.equal((await raw(std, `/api/app/support/attachments/${hu.data.id}`)).status, 404, 'the reseller cannot fetch a screenshot from an internal note'); assert.equal((await raw(host, `/api/host/support/attachments/${hu.data.id}`)).status, 200);
  assert.ok(!JSON.stringify((await app(std, 'GET', `/tickets/${no}`)).data).includes(hu.data.id));
  // the limits are Host settings: screenshots off, then a smaller size
  assert.equal((await hs('PUT', '/settings', { maxFiles: 0 })).status, 200); r = await upload(std, '/api/app/support', PNG); assert.equal(r.data.code, 'SUPPORT_ATTACH_OFF');
  await hs('PUT', '/settings', { maxFiles: 3, maxKB: 50 }); r = await upload(std, '/api/app/support', Buffer.concat([PNG, Buffer.alloc(60 * 1024)])); assert.equal(r.status, 413); await hs('PUT', '/settings', { maxKB: 1024 });
  // an unsent upload is taken back
  const p = await upload(std, '/api/app/support', PNG); assert.equal((await app(std, 'DELETE', `/upload/${p.data.id}`)).status, 200); assert.equal(get('SELECT COUNT(*) AS n FROM support_attachments WHERE id = ?', [p.data.id]).n, 0);
});

test('rate limits: tickets per hour and open tickets per account are Host settings', async () => {
  assert.equal((await hs('PUT', '/settings', { openCap: 100, perHour: 3 })).status, 200);
  let r; const sent = []; for (let i = 0; i < 4; i++) { r = await app(other, 'POST', '/tickets', { category: 'Question', subject: `Beta number ${i}`, message: 'Rate limit probing message.' }); sent.push(r.status); }
  assert.deepEqual(sent, [200, 200, 200, 429], 'three in the hour are fine, the fourth is refused (T-1004 is older than an hour in this test)'); assert.equal(r.data.code, 'SUPPORT_RATE_LIMITED');
  await hs('PUT', '/settings', { perHour: 60, openCap: 3 });
  r = await app(other, 'POST', '/tickets', { category: 'Question', subject: 'Over the cap', message: 'Open ticket cap probing.' }); assert.equal(r.status, 409); assert.equal(r.data.code, 'SUPPORT_OPEN_LIMIT');
  await hs('PUT', '/settings', { perHour: 5, openCap: 10 });
  // replies are limited too (10 in 10 minutes per person)
  const no = (await app(other, 'GET', '/tickets')).data.tickets[0].number; let last; for (let i = 0; i < 11; i++) last = await app(other, 'POST', `/tickets/${no}/messages`, { message: `Message number ${i}` });
  assert.equal(last.status, 429); assert.equal(last.data.code, 'SUPPORT_REPLY_LIMITED');
});

test('Support settings: Host-defined lists and numbers, validated, and every change audited', async () => {
  const s = (await hs('GET', '/settings')).data; assert.deepEqual(s.settings.categories, ['Question', 'Problem', 'Billing', 'Backup and restore', 'Account']); assert.equal(s.settings.responseDays, 2); assert.equal(s.settings.autoCloseDays, 7); assert.equal(s.mailReady, false);
  for (const bad of [{ responseDays: 0 }, { responseDays: 'x' }, { autoCloseDays: 500 }, { maxFiles: 9 }, { maxKB: 10 }, { perHour: 0 }, { openCap: 1000 }, { categories: [] }, { priorities: ['Only'] }, { canned: [{ title: 'No text', body: '' }] }]) { const r = await hs('PUT', '/settings', bad); assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(r.data.code, 'SUPPORT_SETTINGS_BAD'); assert.ok(r.data.error.endsWith('.')); }
  let r = await hs('PUT', '/settings', { categories: ['Question', 'Hardware', 'Question'], priorities: ['Low', 'Normal', 'Critical'], defaultPriority: 'Critical', canned: [{ title: 'Hi', body: 'Hello there.' }] }); assert.equal(r.status, 200);
  const n = (await hs('GET', '/settings')).data.settings; assert.deepEqual(n.categories, ['Question', 'Hardware'], 'duplicates are dropped'); assert.deepEqual(n.priorities, ['Low', 'Normal', 'Critical']); assert.equal(n.canned.length, 1); assert.ok(n.canned[0].id);
  assert.equal((await app(admin, 'GET', '/config')).data.categories.includes('Hardware'), true, 'the reseller form follows');
  r = await app(admin, 'POST', '/tickets', { category: 'Billing', subject: 'Removed category', message: 'Billing is no longer a category.' }); assert.equal(r.data.code, 'SUPPORT_CATEGORY_BAD');
  r = await app(admin, 'POST', '/tickets', { category: 'Hardware', subject: 'New category works', message: 'Hardware is a category now.' }); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await hs('GET', `/tickets/${r.data.ticket.number}`)).data.ticket.priority, 'Critical', 'the default priority applies');
  assert.equal((await hs('PATCH', '/tickets/1001', { category: 'Account' })).data.changed.length, 0, 'a ticket may keep a category that was removed');
  assert.equal((await hs('PUT', '/settings', { categories: 'Question\nProblem\nBilling\nBackup and restore\nAccount', priorities: 'Low\nNormal\nHigh\nUrgent', defaultPriority: 'Normal' })).status, 200, 'lists may come as lines of text');
  assert.equal((await helper.req('PUT', '/api/host/support/settings', { perHour: 6 })).status, 200); assert.equal((await helper.req('PUT', '/api/host/support/settings', { perHour: 5 })).status, 200);
});

test('Host notes on a reseller; the account\'s ticket list', async () => {
  let r = await hs('PUT', `/accounts/${acc.id}/notes`, { body: 'Paid by cheque. Prefers phone calls.' }); assert.equal(r.status, 200);
  const d = (await hs('GET', `/accounts/${acc.id}`)).data; assert.equal(d.note.body, 'Paid by cheque. Prefers phone calls.'); assert.equal(d.note.updatedBy, 'admin'); assert.ok(d.tickets.length >= 4);
  assert.equal((await hs('GET', '/tickets/1001')).data.requester.hostNote.body, 'Paid by cheque. Prefers phone calls.');
  assert.ok(!JSON.stringify((await app(admin, 'GET', '/tickets')).data).includes('cheque') && !JSON.stringify((await admin.req('GET', '/api/app/me')).data).includes('cheque'), 'notes never reach the reseller');
  assert.equal((await hs('PUT', `/accounts/${acc.id}/notes`, { body: 'x'.repeat(4001) })).data.code, 'SUPPORT_NOTE_BAD'); assert.equal((await hs('PUT', '/accounts/nope/notes', { body: 'x' })).status, 404);
  await hs('PUT', `/accounts/${acc.id}/notes`, { body: '' }); assert.equal((await hs('GET', `/accounts/${acc.id}`)).data.note, null, 'an empty note clears it');
});

test('retention: closed tickets are kept until the Owner purges them (confirmation, audited); only closed ones can go', async () => {
  const closed = Number(get("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'closed'").n); assert.ok(closed >= 2);
  assert.equal(get("SELECT COUNT(*) AS n FROM support_messages").n > 0, true);
  await host.req('POST', '/api/host/alerts/check'); assert.equal(Number(get("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'closed'").n), closed, 'nothing purges by itself');
  let r = await hs('POST', '/purge', { confirm: 'PURGE', days: 0 }, helper); assert.equal(r.status, 403); assert.equal(r.data.code, 'SUPPORT_OWNER_ONLY'); assert.equal(Number(get("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'closed'").n), closed);
  r = await hs('POST', '/purge', { days: 0 }); assert.equal(r.status, 400); assert.equal(r.data.code, 'SUPPORT_PURGE_CONFIRM');
  r = await hs('POST', '/purge', { confirm: 'purge', days: 0 }); assert.equal(r.status, 400);
  r = await hs('POST', '/purge', { confirm: 'PURGE', days: -1 }); assert.equal(r.data.code, 'SUPPORT_PURGE_BAD');
  r = await hs('POST', '/purge', { confirm: 'PURGE', number: 1001 }); assert.equal(r.status, 409, 'an open ticket cannot be purged');
  assert.equal((await hs('GET', '/purge-preview?days=0')).data.count, closed); assert.equal((await hs('GET', '/purge-preview?days=30')).data.count, 0, 'none were closed 30 days ago');
  r = await hs('POST', '/purge', { confirm: 'PURGE', days: 30 }); assert.equal(r.data.tickets, 0);
  r = await hs('POST', '/purge', { confirm: 'PURGE', number: 1002 }); assert.equal(r.status, 200); assert.equal(r.data.tickets, 1); assert.deepEqual(r.data.numbers, ['T-1002']);
  assert.equal(get('SELECT COUNT(*) AS n FROM support_messages WHERE ticket_id = (SELECT 1)').n, 0); assert.equal((await hs('GET', '/tickets/1002')).status, 404); assert.equal((await app(view, 'GET', '/tickets/1002')).status, 404);
  r = await hs('POST', '/purge', { confirm: 'PURGE', days: 0 }); assert.equal(r.data.tickets, closed - 1); assert.equal(Number(get("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'closed'").n), 0);
  assert.equal(Number(get("SELECT COUNT(*) AS n FROM support_attachments WHERE ticket_id NOT IN (SELECT id FROM support_tickets)").n), 0, 'screenshots go with their ticket');
});

test('everything the Host does is in the audit trail, with a Support tickets filter; reseller actions are not Host actions', async () => {
  await sleep(900);
  const types = (await host.req('GET', '/api/host/audit/types')).data; assert.ok(types.some(t => t.id === 'support'));
  const rows = (await host.req('GET', '/api/host/audit?type=support')).data.rows, labels = new Set(rows.map(x => x.label));
  for (const l of ['Ticket reply sent', 'Internal note added', 'Ticket status changed', 'Ticket priority or category changed', 'Ticket assigned', 'Support settings changed', 'Host note on a reseller saved', 'Closed tickets purged', 'Ticket closed automatically', 'Ticket opened by the Host']) assert.ok(labels.has(l), `audited: ${l}`);
  assert.ok(rows.every(x => x.actor), 'every entry names who did it'); assert.ok(rows.some(x => x.account_code === acc.account_code), 'and the reseller it was about');
  assert.ok(rows.some(x => x.event === 'support.purge' && /Purged/.test(x.message) && x.actor === 'admin')); assert.ok(rows.some(x => x.event === 'support.purge' && /refused/.test(x.message) && x.actor === 'helper'), 'a refused purge is recorded too');
  const all = (await host.req('GET', '/api/host/audit?type=actions')).data.rows; assert.ok(!all.some(x => x.event.startsWith('support.')), 'kept out of the general group, shown under its own');
  assert.ok(!(await host.req('GET', '/api/host/audit?q=ticket_opened')).data.rows.length, 'a reseller opening a ticket is tenant activity, not a Host action');
});

test('the migration is recorded, and ticket tables are copied between databases', async () => {
  assert.ok(get('SELECT id FROM schema_migrations WHERE id = 17'));
  const { COPY_ORDER } = await import('../src/db/schema.mjs'); for (const t of ['support_tickets', 'support_messages', 'support_attachments', 'support_notes', 'support_views']) assert.ok(COPY_ORDER.includes(t), t);
});

test('screenshots and tickets are in the database, so snapshots and full-site backups carry them', async () => {
  const r = await app(admin, 'POST', '/tickets', { category: 'Question', subject: 'Backup carries me', message: 'Check the snapshot for this ticket.', attachmentIds: [(await upload(admin, '/api/app/support', PNG, 'carried.png')).data.id] }); assert.equal(r.status, 200);
  const made = await host.req('POST', '/api/host/backups'); assert.equal(made.status, 200);
  const { DatabaseSync } = await import('node:sqlite'); const real = path.join(srv.dir, 'backup', made.data.name);
  const snap = new DatabaseSync(real); try {
    assert.equal(snap.prepare("SELECT COUNT(*) AS n FROM support_tickets WHERE subject = 'Backup carries me'").get().n, 1); assert.equal(snap.prepare("SELECT COUNT(*) AS n FROM support_attachments WHERE name = 'carried.png'").get().n, 1, 'the screenshot is in the snapshot');
  } finally { snap.close(); }
});

test('an erased account leaves its tickets for the Host, closed, with the account name kept', async () => {
  const n = (await app(other, 'GET', '/tickets')).data.tickets.length; assert.ok(n >= 1);
  const o = (await host.req('GET', '/api/host/accounts')).data.find(a => a.business_name === 'Beta Shop');
  assert.equal((await host.req('DELETE', `/api/host/accounts/${o.id}`, { confirm: o.account_code, reason: 'test' })).status, 200);
  const rows = (await hs('GET', '/tickets?status=all&q=beta')).data.tickets; assert.ok(rows.length >= 1); assert.ok(rows.every(t => t.status === 'closed' && t.accountName === 'Beta Shop'));
  const d = (await hs('GET', `/tickets/${rows[0].number}`)).data; assert.equal(d.requester.account.gone, true); assert.equal(d.requester.account.name, 'Beta Shop');
});
