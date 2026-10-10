// TEST / t43-mail-test-reporting — Host > Email: "Send test email" and "Check my email setup" say plainly what went wrong, in order (settings, connection, sign-in, send),
// using fake mail servers; the mail password never appears in any answer, log or stored value; the last result is remembered and drives the warning.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, Client, allLogText } from './helpers.mjs';
import { classify, scrub, KINDS } from '../src/services/mail/diagnose.mjs';
import { MSG } from '../src/core/messages.mjs';

const PW = 'Sup3rSecretPass!', MAILPW = 'Rel4y-S3cret-pw!';
let srv, host, fake, port, behavior = {};
// A small fake mail server. behavior: { auth: 'ok'|'refuse', mailFrom: code line, rcpt: code line, data: code line, silent: bool, banner: line }
const startFake = () => new Promise((resolve) => {
  fake = net.createServer((s) => {
    if (behavior.silent) return;      // accepts the connection, never says hello
    let buf = '', inData = false, authStage = 0;
    const w = (l) => s.write(l + '\r\n');
    w(behavior.banner || '220 fake ESMTP ready');
    s.on('data', (b) => {
      buf += b; let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) { if (line === '.') { inData = false; w(behavior.data || '250 2.0.0 queued'); } continue; }
        if (authStage) { authStage = 0; w(behavior.auth === 'refuse' ? `535 5.7.8 Authentication failed for password ${MAILPW}` : '235 2.7.0 ok'); continue; }
        const c = line.toUpperCase();
        if (c.startsWith('EHLO') || c.startsWith('HELO')) { s.write('250-fake\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n'); }
        else if (c.startsWith('AUTH PLAIN') && line.length > 11) w(behavior.auth === 'refuse' ? `535 5.7.8 Authentication failed for password ${MAILPW}` : '235 2.7.0 ok');
        else if (c.startsWith('AUTH')) { authStage = 1; w('334 '); }
        else if (c.startsWith('MAIL FROM')) w(behavior.mailFrom || '250 ok');
        else if (c.startsWith('RCPT TO')) w(behavior.rcpt || '250 ok');
        else if (c === 'DATA') { inData = true; w('354 go'); }
        else if (c === 'QUIT') { w('221 bye'); s.end(); }
        else w('250 ok');
      }
    });
    s.on('error', () => {});
  });
  fake.listen(0, '127.0.0.1', () => { port = fake.address().port; resolve(); });
});
const setMail = (o = {}) => host.req('PUT', '/api/host/mail', { enabled: true, mode: 'smtp', fromName: 'Site', fromAddress: 'noreply@example.com', ...o, smtp: { host: '127.0.0.1', port, secure: false, user: 'relayuser', pass: MAILPW, ...(o.smtp || {}) } });
const run = async (path = '/test', to = 'owner@example.com') => (await host.req('POST', '/api/host/mail' + path, { to })).data;
const stepStatus = (r) => Object.fromEntries(r.result.steps.map(s => [s.key, s.status]));

test.before(async () => {
  await startFake();
  srv = await startServer({ MAIL_GREETING_MS: '700' }); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
});
test.after(() => { srv?.stop(); fake?.closeAllConnections?.(); fake?.close(); });

test('every failure kind has a title, a cause, a next step and a catalog message', () => {
  for (const [k, v] of Object.entries(KINDS)) { assert.ok(v.title && v.cause && v.next, k); assert.equal(MSG['MAIL_TEST_' + k.toUpperCase()], `${v.cause} ${v.next}`, k); }
  assert.deepEqual(Object.keys(KINDS).sort(), ['auth', 'blocked', 'other', 'sender', 'settings', 'tls', 'unauthenticated', 'unreachable']);
});

test('what the mail server says is mapped to the right kind', () => {
  const e = (code, responseCode, response, message = '') => Object.assign(new Error(message || response || code), { code, responseCode, response });
  assert.equal(classify(e('ECONNECTION', 0, '', 'connect ECONNREFUSED')), 'unreachable'); assert.equal(classify(e('ENOTFOUND', 0, '', 'getaddrinfo ENOTFOUND smtp.nope')), 'unreachable');
  assert.equal(classify(e('ESOCKET', 0, '', 'error:0A00010B:SSL routines::wrong version number')), 'tls'); assert.equal(classify(e('ETIMEDOUT', 0, '', 'Greeting never received')), 'tls');
  assert.equal(classify(e('EAUTH', 535, '535 5.7.8 Username and Password not accepted')), 'auth');
  assert.equal(classify(e('EENVELOPE', 553, '553 5.7.1 Sender address rejected: not owned by user')), 'sender'); assert.equal(classify(e('EMESSAGE', 550, '550 5.7.60 SMTP; Client does not have permissions to send as this sender')), 'sender');
  assert.equal(classify(e('EMESSAGE', 550, '550 5.7.26 This message does not pass authentication checks (SPF and DKIM both do not pass)')), 'unauthenticated');
  assert.equal(classify(e('EMESSAGE', 421, '421 4.7.0 Too many messages, rate limited')), 'blocked'); assert.equal(classify(e('EMESSAGE', 554, '554 5.7.1 Service unavailable; client host blocked using Spamhaus')), 'blocked');
  assert.equal(classify(e('EMESSAGE', 500, '500 something odd')), 'other');
});

test('the password is scrubbed from any text', () => {
  const t = scrub(`535 login failed for password ${MAILPW}; AUTH PLAIN ${Buffer.from('\0relayuser\0' + MAILPW).toString('base64')} and ${Buffer.from(MAILPW).toString('base64')}`, [MAILPW]);
  assert.ok(!t.includes(MAILPW) && !t.includes(Buffer.from(MAILPW).toString('base64')) && !/AUTH PLAIN [A-Za-z0-9+/=]{6,}/.test(t), t);
});

test('settings problems stop at the first tick', async () => {
  let r = await run('/check'); assert.equal(r.result.failure.kind, 'settings'); assert.deepEqual(stepStatus(r), { settings: 'fail', connect: 'notrun', signin: 'notrun', send: 'notrun' });
  assert.equal(r.ok, false); assert.match(r.result.failure.next, /Turn on Send email/);
});

test('a working setup passes every step in order, and the result is remembered', async () => {
  behavior = {}; assert.equal((await setMail()).status, 200);
  assert.equal((await host.req('GET', '/api/host/mail/test-status')).data.needsTest, true, 'on but never tested');
  const r = await run('/check'); assert.equal(r.ok, true, JSON.stringify(r.result.failure)); assert.equal(r.status, 'sent');
  assert.deepEqual({ ...stepStatus(r), send: 'ok' }, { settings: 'ok', connect: 'ok', signin: 'ok', send: 'ok' }); assert.ok(['ok', 'warn'].includes(stepStatus(r).send), 'warn = accepted but the domain has no SPF/DMARC record'); assert.deepEqual(r.result.steps.map(s => s.key), ['settings', 'connect', 'signin', 'send']);
  const st = (await host.req('GET', '/api/host/mail/test-status')).data; assert.equal(st.passedSinceChange, true); assert.equal(st.needsTest, false); assert.equal(st.last.ok, true); assert.ok(st.last.at > Date.now() - 60000);
  assert.equal((await host.req('GET', '/api/host/mail/health')).data.test.passedSinceChange, true);
  const q = (await host.req('GET', '/api/host/mail/queue')).data.queue; assert.ok(q.some(m => m.to_addr === 'owner@example.com' && m.status === 'sent'), 'the test shows under Recent messages');
});

test('changing the settings makes the earlier test not count: warning on Alerts and Overview', async () => {
  await setMail({ fromAddress: 'other@example.com' });
  const st = (await host.req('GET', '/api/host/mail/test-status')).data; assert.equal(st.needsTest, true); assert.equal(st.last.current, false);
  const open = (await host.req('POST', '/api/host/alerts/check')).data.open; assert.ok(open.some(a => a.kind === 'email.untested' && /settings changed/.test(a.detail)));
  assert.equal((await host.req('GET', '/api/host/dashboard')).data.mailUntested, true);
  assert.equal((await run('/test')).ok, true);
  assert.ok(!(await host.req('POST', '/api/host/alerts/check')).data.open.some(a => a.kind === 'email.untested'), 'cleared by a passing test');
  assert.equal((await host.req('GET', '/api/host/dashboard')).data.mailUntested, false);
  await host.req('PUT', '/api/host/mail', { enabled: false, mode: 'smtp', fromAddress: 'other@example.com', smtp: { host: '127.0.0.1', port, user: 'relayuser', pass: '********' } });
  assert.equal((await host.req('GET', '/api/host/mail/test-status')).data.needsTest, false, 'email off: nothing to warn about');
});

test('each common failure shows the right plain message and the failing tick', async () => {
  const expect = async (kind, step, setup, over) => {
    behavior = setup || {}; await setMail(over || {}); const r = await run('/test');
    assert.equal(r.ok, false, kind); assert.equal(r.result.failure.kind, kind, `${kind}: ${JSON.stringify(r.result.failure)}`); assert.equal(r.result.steps.find(s => s.key === step).status, 'fail', kind);
    assert.equal(r.result.failure.code, 'MAIL_TEST_' + kind.toUpperCase()); assert.ok(r.result.failure.cause && r.result.failure.next && r.result.failure.detail, kind);
    assert.match(r.error, new RegExp(r.result.failure.title)); return r;
  };
  await expect('unreachable', 'connect', {}, { smtp: { port: 9 } });
  await expect('unreachable', 'connect', {}, { smtp: { host: 'no-such-host.invalid' } });
  await expect('tls', 'connect', { silent: true });   // a server that says nothing: it probably expects TLS from the start (or the port is wrong)
  const a = await expect('auth', 'signin', { auth: 'refuse' });
  assert.ok(!JSON.stringify(a).includes(MAILPW), 'the refused password is not echoed back');
  await expect('sender', 'send', { mailFrom: '553 5.7.1 Sender address rejected: not owned by user relayuser' });
  await expect('blocked', 'send', { rcpt: '450 4.7.1 Too many messages, rate limited, try again later' });
  await expect('blocked', 'connect', { banner: '554 5.7.1 Service unavailable; client host blocked using Spamhaus' });
  const u = await expect('unauthenticated', 'send', { data: '550 5.7.26 This message does not pass authentication checks (SPF and DKIM both do not pass)' }); assert.match(u.result.failure.next, /Sender checks/);
  await expect('other', 'send', { data: '500 something nobody planned for' });
  const down = (await host.req('GET', '/api/host/mail/test-status')).data; assert.equal(down.last.ok, false); assert.equal(down.last.kind, 'other');
});

test('the mail password is in no answer, no audit entry, no log and no stored test result', async () => {
  behavior = { auth: 'refuse' }; await setMail(); const a = await run('/check'); behavior = {}; await setMail(); const b = await run('/check');
  for (const x of [a, b, (await host.req('GET', '/api/host/mail')).data, (await host.req('GET', '/api/host/mail/health')).data, (await host.req('GET', '/api/host/mail/test-status')).data, (await host.req('GET', '/api/host/mail/queue')).data, (await host.req('GET', '/api/host/audit')).data]) assert.ok(!JSON.stringify(x).includes(MAILPW));
  await new Promise(r => setTimeout(r, 600));
  assert.ok(!allLogText(srv.logDir).includes(MAILPW), 'not in any log file');
  const { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db'));
  try { for (const r of d.prepare("SELECT v FROM settings WHERE k IN ('mail_last_test')").all()) assert.ok(!r.v.includes(MAILPW)); assert.ok(!d.prepare('SELECT group_concat(last_error) AS e FROM mail_queue').get().e?.includes(MAILPW)); assert.ok(!d.prepare("SELECT group_concat(message || raw) AS e FROM event_log").get().e.includes(MAILPW)); } finally { d.close(); }
  assert.ok(fs.existsSync(srv.logDir));
});

test('tests are logged: every run writes an audit entry saying how it ended', async () => {
  let rows = []; for (let i = 0; i < 30; i++) { rows = (await host.req('GET', '/api/host/audit')).data.rows.filter(x => x.event === 'mail.test'); if (rows.length >= 6) break; await new Promise(r => setTimeout(r, 200)); }
  assert.ok(rows.length >= 5); assert.ok(rows.some(x => /not sent \(/.test(x.message)) && rows.some(x => /: sent/.test(x.message)));
});

test('a bad recipient is refused before any test runs', async () => {
  assert.equal((await host.req('POST', '/api/host/mail/test', { to: 'nope' })).status, 400);
});
