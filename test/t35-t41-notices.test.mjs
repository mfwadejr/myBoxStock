// TEST / t35-t41-notices — T35 new-ticket alert and email to the Host, T36 change marker for the live list, T41 the Overdue count.
// Covers: decided defaults, alert on submit (Standard and View too), red for High/Urgent, clears on open or reply, reseller-reply alerts, email only when Email works and
// is switched on, recipients, threshold, the per-hour cap, daily digest, everything logged, no secrets in the email, the summary marker and the overdue number.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const PW = 'Sup3rSecretPass!', USERPW = 'Usr-pass-12345', DAY = 86400e3;
let srv, host, admin, std, view, db, adminId, helperId;
const sql = (q, args = []) => db.prepare(q).run(...args), get = (q, args = []) => db.prepare(q).get(...args), all = (q, args = []) => db.prepare(q).all(...args);
const app = (c, m, p, b) => c.req(m, '/api/app/support' + p, b), hs = (m, p, b) => host.req(m, '/api/host/support' + p, b);
const alerts = async () => (await host.req('GET', '/api/host/alerts')).data;
const open = async (c, subject, extra = {}) => { const r = await app(c, 'POST', '/tickets', { category: 'Problem', subject, message: 'First line of the message.\nSecond line.\nThird line.\nFourth line should not be in the email.', ...extra }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.ticket.number; };
const mails = (like = '%support ticket%') => all('SELECT * FROM mail_queue WHERE subject LIKE ? ORDER BY created_at, id', [like]);
const waitFor = async (fn, ms = 4000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return v; await sleep(100); } };
const logged = (event) => waitFor(() => { const r = get("SELECT COUNT(*) AS n FROM event_log WHERE event = ?", [event]); return Number(r.n) > 0 && Number(r.n); });
const newUser = async (role, name) => {
  const a = await admin.req('POST', '/api/app/users', { username: name, role, password: USERPW }); assert.equal(a.status, 200);
  const c = new Client(srv.base); await c.req('POST', '/api/app/login', { login: a.data.login, password: USERPW });
  await c.req('POST', '/api/app/change-password', { current: USERPW, next: USERPW + 'x' }); return c;
};
const smtp = (enabled) => ({ enabled, mode: 'smtp', fromName: 'T', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', port: 1, secure: false, user: '', pass: '' } });
const setAll = async (o) => { const r = await hs('PUT', '/settings', o); assert.equal(r.status, 200, JSON.stringify(r.data)); };

test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 50000, windowSec: 60, authMaxAttempts: 5000, authWindowSec: 60, banAfterViolations: 500, banMinutes: 1 });
  await host.req('POST', '/api/host/admins', { username: 'helper', email: 'helper@example.com', password: 'Temp0rarySecret!' });
  admin = new Client(srv.base); await admin.req('POST', '/api/app/signup', { businessName: 'Alpha Shop', email: 'alpha@example.com', username: 'alpha', password: PW });
  const acc = (await host.req('GET', '/api/host/accounts')).data[0]; await admin.req('POST', '/api/app/login', { login: `alpha@${acc.account_code}`, password: PW });
  std = await newUser('Standard', 'stan'); view = await newUser('View', 'vic');
  const { DatabaseSync } = await import('node:sqlite'); db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); db.exec('PRAGMA busy_timeout = 5000');
  await hs('PUT', '/settings', { perHour: 60, openCap: 100 });   // the tests open many tickets
  const staff = (await hs('GET', '/staff')).data; adminId = staff.find(s => s.username === 'admin').id; helperId = staff.find(s => s.username === 'helper').id;
});
test.after(() => { try { db?.close(); } catch {} srv?.stop(); });

test('T35 defaults are the decided ones', async () => {
  const s = (await hs('GET', '/settings')).data;
  assert.equal(s.settings.notifyInApp, true); assert.equal(s.settings.notifyEmail, false); assert.equal(s.settings.notifyRecipients, 'all'); assert.equal(s.settings.notifyThreshold, 'every');
  assert.equal(s.settings.notifyReplyInApp, true); assert.equal(s.settings.notifyReplyEmail, false); assert.equal(s.settings.notifyDigest, false); assert.equal(s.settings.notifyPerHour, 20);
  assert.equal(s.mailReady, false); assert.ok(s.staffList.some(a => a.username === 'helper'));
  assert.equal((await hs('PUT', '/settings', { notifyRecipients: 'nobody' })).status, 400); assert.equal((await hs('PUT', '/settings', { notifyThreshold: 'sometimes' })).status, 400);
  assert.equal((await hs('PUT', '/settings', { notifyPerHour: 0 })).status, 400); assert.equal((await hs('PUT', '/settings', { notifyRecipients: 'chosen', notifyChosen: [] })).status, 400, 'a chosen list needs someone in it');
});

test('T35 a submitted ticket raises an alert for Standard and View resellers too, High and Urgent show red, and nothing is emailed by default', async () => {
  const before = (await host.req('GET', '/api/host/alerts/count')).data.open;
  const n1 = await open(std, 'Scanner will not focus');
  let a = (await alerts()).open.find(x => x.dedupe_key === `support.ticket.${n1}`);
  assert.ok(a, 'alert exists'); assert.match(a.title, new RegExp(`^New ticket #${n1} from Alpha Shop: Scanner will not focus \\(Normal priority\\)$`)); assert.equal(a.level, 'info'); assert.equal(a.kind, 'support.ticket');
  assert.equal((await host.req('GET', '/api/host/alerts/count')).data.open, before + 1, 'the Alerts count rises');
  const n2 = await open(view, 'Viewer question'); assert.ok((await alerts()).open.some(x => x.dedupe_key === `support.ticket.${n2}`), 'a View reseller ticket alerts too');
  await setAll({ defaultPriority: 'Urgent' }); const n3 = await open(admin, 'Everything is down');
  a = (await alerts()).open.find(x => x.dedupe_key === `support.ticket.${n3}`); assert.equal(a.level, 'error', 'Urgent is red'); assert.match(a.title, /\(Urgent priority\)/);
  await setAll({ defaultPriority: 'High' }); const n4 = await open(std, 'High one'); assert.equal((await alerts()).open.find(x => x.dedupe_key === `support.ticket.${n4}`).level, 'error', 'High is red');
  await setAll({ defaultPriority: 'Normal' });
  assert.equal(mails().length, 0, 'email is off by default: nothing was queued');
  assert.equal(get("SELECT COUNT(*) AS n FROM alerts WHERE kind = 'support.ticket' AND emailed_at IS NOT NULL").n, 0, 'the generic alert email to the Owner is not used for tickets');
  assert.ok(await logged('support.notice'), 'the notice is in the audit trail');
});

test('T35 the alert clears when the ticket is opened or replied to', async () => {
  const n1 = (await alerts()).open.find(x => /Scanner will not focus/.test(x.title)).dedupe_key.split('.').pop();
  assert.equal((await hs('GET', `/tickets/${n1}`)).status, 200);
  let d = await alerts(); assert.ok(!d.open.some(x => x.dedupe_key === `support.ticket.${n1}`), 'opened: gone from Needs a look'); assert.ok(d.recent.some(x => x.dedupe_key === `support.ticket.${n1}`), 'and listed under Recently cleared');
  const n2 = (await alerts()).open.find(x => /Viewer question/.test(x.title)).dedupe_key.split('.').pop();
  assert.equal((await hs('POST', `/tickets/${n2}/reply`, { message: 'We are on it.' })).status, 200);
  d = await alerts(); assert.ok(!d.open.some(x => x.dedupe_key === `support.ticket.${n2}`), 'replied: gone');
  // an internal note is not an answer
  const n3 = await open(std, 'Note only'); await hs('POST', `/tickets/${n3}/reply`, { message: 'hidden note', internal: true });
  assert.ok((await alerts()).open.some(x => x.dedupe_key === `support.ticket.${n3}`), 'a note leaves the alert'); 
  // a ticket resolved some other way clears at the next check
  await hs('PATCH', `/tickets/${n3}`, { status: 'resolved' }); await host.req('POST', '/api/host/alerts/check');
  assert.ok(!(await alerts()).open.some(x => x.dedupe_key === `support.ticket.${n3}`), 'no longer waiting on the Host: the check clears it');
});

test('T35 a reseller reply on a ticket waiting on the Host raises a reply alert; the switch turns it off', async () => {
  const n = await open(std, 'Needs a follow-up'); await hs('POST', `/tickets/${n}/reply`, { message: 'Please try this.' });
  let r = await app(std, 'POST', `/tickets/${n}/messages`, { message: 'Tried it, same problem.' }); assert.equal(r.status, 200);
  const a = (await alerts()).open.find(x => x.dedupe_key === `support.reply.${n}`); assert.ok(a, 'reply alert'); assert.match(a.title, new RegExp(`^Reseller replied on ticket #${n} from Alpha Shop`)); assert.equal(a.kind, 'support.reply');
  await hs('GET', `/tickets/${n}`); assert.ok(!(await alerts()).open.some(x => x.dedupe_key === `support.reply.${n}`), 'opening clears it');
  await setAll({ notifyReplyInApp: false }); await hs('POST', `/tickets/${n}/reply`, { message: 'Again.' });
  await app(std, 'POST', `/tickets/${n}/messages`, { message: 'Still the same.' }); assert.ok(!(await alerts()).open.some(x => x.dedupe_key === `support.reply.${n}`), 'switched off: no alert');
  await setAll({ notifyReplyInApp: true, notifyInApp: false }); const m = await open(std, 'No alert for this'); assert.ok(!(await alerts()).open.some(x => x.dedupe_key === `support.ticket.${m}`), 'in-app switch off: no alert');
  await setAll({ notifyInApp: true });
});

test('T35 email notices need Email set up, then go to the right people with the right words', async () => {
  let r = await hs('PUT', '/settings', { notifyEmail: true }); assert.equal(r.status, 409); assert.equal(r.data.code, 'SUPPORT_NOTIFY_MAIL_OFF', 'cannot switch on before Email is set up');
  assert.equal((await hs('GET', '/settings')).data.settings.notifyEmail, false);
  assert.equal((await host.req('PUT', '/api/host/mail', smtp(true))).status, 200);
  await host.req('POST', '/api/host/alerts/check'); const rem = (await alerts()).open.find(x => x.kind === 'support.notify_off'); assert.ok(rem, 'Alerts remind the owner while email notices are still off'); assert.match(rem.title, /switched off/);
  await host.req('PUT', `/api/host/admins/${adminId}`, { email: 'owner@example.com' });
  await setAll({ notifyEmail: true, notifyReplyEmail: false });
  await host.req('POST', '/api/host/alerts/check'); assert.ok(!(await alerts()).open.some(x => x.kind === 'support.notify_off'), 'the reminder clears once switched on');
  const n = await open(std, 'Scanner: please help', { diagnostics: true });
  const rows = await waitFor(() => mails('[myBoxStock] New support ticket%').length >= 2 && mails('[myBoxStock] New support ticket%'), 5000);
  assert.deepEqual(rows.map(x => x.to_addr).sort(), ['helper@example.com', 'owner@example.com'], 'all Host administrators with an address');
  assert.equal(rows[0].subject, `[myBoxStock] New support ticket #${n}: Scanner: please help`);
  for (const t of [rows[0].body_text, rows[0].body_html]) { assert.match(t, /Alpha Shop/); assert.match(t, /Priority:/); assert.match(t, /Category:/); assert.match(t, /First line of the message/); assert.ok(!/Fourth line/.test(t), 'only the first lines'); assert.match(t, new RegExp(`/host/#/support/${n}`)); }
  assert.ok(!/diagnos/i.test(rows[0].body_text.replace('Screenshots and diagnostics are not included in this email.', '')), 'no diagnostics in the email');
  assert.ok(await logged('support.notice_email'), 'each email is in the audit trail');
  // replies: off by default, on when switched on
  await hs('POST', `/tickets/${n}/reply`, { message: 'On it.' }); const count = () => mails('[myBoxStock] Reseller replied%').length;
  await app(std, 'POST', `/tickets/${n}/messages`, { message: 'Thanks.' }); await sleep(300); assert.equal(count(), 0, 'reply email is off by default');
  await setAll({ notifyReplyEmail: true }); await hs('POST', `/tickets/${n}/reply`, { message: 'Again.' }); await app(std, 'POST', `/tickets/${n}/messages`, { message: 'Thanks again.' });
  assert.equal(await waitFor(() => count() === 2 && 2), 2, 'reply email goes to both administrators'); assert.match(mails('[myBoxStock] Reseller replied%')[0].subject, new RegExp(`^\\[myBoxStock\\] Reseller replied on ticket #${n}: Scanner`));
});

test('T35 recipients: Owner only and a chosen list; threshold: only High and Urgent', async () => {
  const sent = async (fn) => { const b = mails('[myBoxStock] New support ticket%').length; await fn(); await sleep(400); return mails('[myBoxStock] New support ticket%').slice(b).map(x => x.to_addr).sort(); };
  await setAll({ notifyRecipients: 'owner' }); assert.deepEqual(await sent(() => open(std, 'Owner only please')), ['owner@example.com']);
  await setAll({ notifyRecipients: 'chosen', notifyChosen: [helperId] }); assert.deepEqual(await sent(() => open(std, 'Chosen list')), ['helper@example.com']);
  await setAll({ notifyRecipients: 'all', notifyThreshold: 'high' });
  assert.deepEqual(await sent(() => open(std, 'Just a normal one')), [], 'Normal priority is below the threshold: no email');
  const quiet = await open(std, 'Another normal'); assert.ok(!(await alerts()).open.some(x => x.dedupe_key === `support.ticket.${quiet}`), 'and no alert either');
  await setAll({ defaultPriority: 'High' }); assert.deepEqual(await sent(() => open(std, 'This is high')), ['helper@example.com', 'owner@example.com'], 'High passes');
  await setAll({ defaultPriority: 'Urgent' }); assert.equal((await sent(() => open(std, 'This is urgent'))).length, 2, 'Urgent passes');
  await setAll({ defaultPriority: 'Normal', notifyThreshold: 'every' });
  assert.ok(await logged('support.notice_skipped'), 'a skipped notice is logged');
});

test('T35 the emails-per-hour cap is respected and logged; the rest still show in Alerts', async () => {
  sql("DELETE FROM settings WHERE k = 'support_notify_state'"); await setAll({ notifyPerHour: 3 });
  const b = mails('[myBoxStock] New support ticket%').length;
  const n1 = await open(std, 'Cap one'), n2 = await open(std, 'Cap two'), n3 = await open(std, 'Cap three'); await sleep(500);
  assert.equal(mails('[myBoxStock] New support ticket%').length - b, 3, 'three emails (the limit), not six');
  for (const n of [n1, n2, n3]) assert.ok((await alerts()).open.some(x => x.dedupe_key === `support.ticket.${n}`), 'the alert is there anyway');
  assert.ok(get("SELECT COUNT(*) AS n FROM event_log WHERE event = 'support.notice_skipped' AND message LIKE '%limit of 3%'").n >= 1 || await waitFor(() => get("SELECT COUNT(*) AS n FROM event_log WHERE event = 'support.notice_skipped' AND message LIKE '%limit of 3%'").n >= 1), 'the cap is logged');
  await setAll({ notifyPerHour: 20 });
});

test('T35 a switched-on email stays quiet when Email is turned off again', async () => {
  assert.equal((await host.req('PUT', '/api/host/mail', smtp(false))).status, 200);
  const b = mails('[myBoxStock] New support ticket%').length; const n = await open(std, 'Mail is off now'); await sleep(400);
  assert.equal(mails('[myBoxStock] New support ticket%').length, b, 'nothing queued'); assert.ok((await alerts()).open.some(x => x.dedupe_key === `support.ticket.${n}`), 'the alert still appears');
  assert.ok(await waitFor(() => get("SELECT COUNT(*) AS n FROM event_log WHERE event = 'support.notice_skipped' AND message LIKE '%Email is not set up%'").n >= 1), 'logged');
  assert.equal((await host.req('PUT', '/api/host/mail', smtp(true))).status, 200);
});

test('T35 the daily digest sends one email instead of one per ticket', async () => {
  await setAll({ notifyDigest: true }); sql("DELETE FROM settings WHERE k = 'support_notify_state'");
  await host.req('POST', '/api/host/alerts/check');   // starts the digest clock
  const b = mails('[myBoxStock] New support ticket%').length, d0 = mails('[myBoxStock] Support digest%').length;
  await open(std, 'Digest A'); await open(std, 'Digest B'); await sleep(300); assert.equal(mails('[myBoxStock] New support ticket%').length, b, 'no per-ticket email in digest mode');
  await host.req('POST', '/api/host/alerts/check'); assert.equal(mails('[myBoxStock] Support digest%').length, d0, 'not due yet');
  sql("UPDATE settings SET v = ? WHERE k = 'support_notify_state'", [JSON.stringify({ sent: [], lastDigestAt: Date.now() - 25 * 3600e3 })]);
  await host.req('POST', '/api/host/alerts/check'); const dg = mails('[myBoxStock] Support digest%').slice(d0);
  assert.equal(dg.length, 2, 'one digest per recipient'); assert.match(dg[0].body_text, /Digest A/); assert.match(dg[0].body_text, /Digest B/);
  await host.req('POST', '/api/host/alerts/check'); assert.equal(mails('[myBoxStock] Support digest%').length - d0, 2, 'and only once a day'); assert.ok(await logged('support.notice_digest'));
  await setAll({ notifyDigest: false });
});

test('T36 the summary carries a change marker that moves only when something changed', async () => {
  const a = (await hs('GET', '/summary')).data; assert.equal(typeof a.latest, 'string'); assert.ok(a.newest >= 1001);
  assert.equal((await hs('GET', '/summary')).data.latest, a.latest, 'unchanged: same marker');
  const n = await open(std, 'Marker ticket'); const b = (await hs('GET', '/summary')).data; assert.notEqual(b.latest, a.latest, 'a new ticket moves it'); assert.equal(b.newest, n);
  await sleep(5); await hs('POST', `/tickets/${n}/reply`, { message: 'Reply.' }); const c = (await hs('GET', '/summary')).data; assert.notEqual(c.latest, b.latest, 'a reply moves it');
  await sleep(5); await hs('PATCH', `/tickets/${n}`, { priority: 'High' }); assert.notEqual((await hs('GET', '/summary')).data.latest, c.latest, 'a change moves it');
  const l = (await hs('GET', '/tickets?status=all')).data; assert.equal(l.newest, n); assert.equal(typeof l.latest, 'string');
  const lim = (await hs('GET', '/tickets?status=all&limit=500')).data; assert.equal(lim.tickets.length, lim.total, 'a refresh can ask for as many rows as are on screen'); assert.equal(lim.total, l.total);
});

test('T41 the Overdue count equals the tickets really past target, hits zero, and follows replies', async () => {
  sql("UPDATE support_tickets SET status = 'closed'");   // a clean slate: nothing waiting
  let s = (await hs('GET', '/summary')).data; assert.equal(s.overdue, 0, 'zero state'); assert.equal((await hs('GET', '/tickets?status=overdue')).data.total, 0);
  const a = await open(std, 'Old one'), b = await open(std, 'Older one'), c = await open(std, 'Fresh one');
  const old = Date.now() - 10 * DAY;   // far more than 2 business days
  sql('UPDATE support_tickets SET created_at = ?, last_requester_at = ?, updated_at = ? WHERE number IN (?, ?)', [old, old, old, a, b]);
  s = (await hs('GET', '/summary')).data; assert.equal(s.overdue, 2); assert.equal(s.responseDays, 2);
  const list = (await hs('GET', '/tickets?status=overdue')).data; assert.equal(list.total, 2, 'the list filter agrees with the count'); assert.deepEqual(list.tickets.map(t => t.number).sort(), [a, b].sort()); assert.ok(list.tickets.every(t => t.overdue));
  assert.ok(!list.tickets.some(t => t.number === c), 'a fresh ticket is not overdue');
  await host.req('POST', '/api/host/alerts/check'); const al = (await alerts()).open.find(x => x.kind === 'support.overdue'); assert.match(al.detail, /^2 tickets have waited/, 'the alert uses the same number');
  await hs('POST', `/tickets/${a}/reply`, { message: 'Sorry for the wait.' }); assert.equal((await hs('GET', '/summary')).data.overdue, 1, 'a reply lowers it');
  await hs('PATCH', `/tickets/${b}`, { status: 'resolved' }); s = (await hs('GET', '/summary')).data; assert.equal(s.overdue, 0, 'a status change lowers it'); assert.equal(s.awaitingHost, 1);
  const ov = (await host.req('GET', '/api/host/dashboard')).data; if (ov.support) assert.equal(ov.support.overdue, s.overdue, 'the Overview card shows the same number');
});
