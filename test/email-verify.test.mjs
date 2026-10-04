// TEST / email-verify — soft email confirmation: the account works at once; email reset and inviting people wait for the confirmation;
// nothing happens when email is off; people from before the feature are never held back; changing the address needs the new mailbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let srv, host, d;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
  if (sqlite) { const { DatabaseSync } = await import('node:sqlite'); d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000'); }
});
test.after(() => srv?.stop());
const mailOn = (on) => host.req('PUT', '/api/host/mail', { enabled: on, mode: 'smtp', fromName: 'T', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', port: 587, secure: false, user: '', pass: '' } });
const mails = (to, re) => d.prepare('SELECT subject, body_text FROM mail_queue WHERE to_addr = ?').all(to).filter(m => re.test(m.subject));
const tokenOf = (to) => { const m = mails(to, /Confirm your email/).at(-1); return m && m.body_text.match(/#\/confirm\/([\w-]+)/)?.[1]; };
async function signedIn(email, username, biz) {
  const c = new Client(srv.base), r = await c.req('POST', '/api/app/signup', { businessName: biz, email, username, password: PW });
  const s = await c.req('POST', '/api/app/login', { resellerId: r.data.resellerId, username, password: PW }); assert.equal(s.status, 200); return { c, ...r.data };
}
const addPerson = (c, n) => c.req('POST', '/api/app/users', { username: n, email: `${n}@example.com`, role: 'Standard', password: 'Temp-pass-12345' });

test('with email off nothing is held and nothing is sent', { skip: !sqlite && 'SQLite-only' }, async () => {
  const a = await signedIn('off@example.com', 'olly', 'Off Co');
  assert.equal(mails('off@example.com', /Confirm your email/).length, 0);
  const me = (await a.c.req('GET', '/api/app/me')).data.user; assert.equal(me.emailBanner, false); assert.equal(me.emailHeld, false);
  assert.equal((await addPerson(a.c, 'helper1')).status, 200);
});

test('with email on: banner, held actions, resend limit, confirmation, then everything works', { skip: !sqlite && 'SQLite-only' }, async () => {
  assert.equal((await mailOn(true)).status, 200);
  const a = await signedIn('on@example.com', 'ona', 'On Co'); const tok = tokenOf('on@example.com'); assert.ok(tok, 'a confirmation email was queued at signup');
  let me = (await a.c.req('GET', '/api/app/me')).data.user; assert.equal(me.emailVerified, false); assert.equal(me.emailBanner, true); assert.equal(me.emailHeld, true);
  let r = await addPerson(a.c, 'helper2'); assert.equal(r.status, 403); assert.equal(r.data.code, 'EMAIL_NOT_CONFIRMED');
  await new Client(srv.base).req('POST', '/api/app/forgot', { email: 'on@example.com' }); await sleep(200);
  assert.equal(mails('on@example.com', /Reset your/).length, 0, 'no reset email until the address is confirmed');
  assert.equal((await a.c.req('POST', '/api/app/email/resend')).status, 429, 'resend is rate-limited');
  assert.equal((await new Client(srv.base).req('POST', '/api/app/confirm-email', { token: 'nope' })).status, 400);
  assert.equal((await new Client(srv.base).req('POST', '/api/app/confirm-email', { token: tok })).status, 200);
  assert.equal((await new Client(srv.base).req('POST', '/api/app/confirm-email', { token: tok })).status, 400, 'a link works once');
  me = (await a.c.req('GET', '/api/app/me')).data.user; assert.equal(me.emailVerified, true); assert.equal(me.emailBanner, false);
  assert.equal((await addPerson(a.c, 'helper2')).status, 200);
  await new Client(srv.base).req('POST', '/api/app/forgot', { email: 'on@example.com' }); await sleep(200);
  assert.equal(mails('on@example.com', /Reset your/).length, 1, 'reset by email works once confirmed');
});

test('changing the address needs the password and the new mailbox; the old address stays until then', { skip: !sqlite && 'SQLite-only' }, async () => {
  const a = await signedIn('first@example.com', 'chad', 'Change Co'); await new Client(srv.base).req('POST', '/api/app/confirm-email', { token: tokenOf('first@example.com') });
  let r = await a.c.req('POST', '/api/app/email/change', { email: 'second@example.com', password: 'wrong-password-1' }); assert.equal(r.status, 400);
  r = await a.c.req('POST', '/api/app/email/change', { email: 'not-an-email', password: PW }); assert.equal(r.status, 400);
  await sleep(100); d.prepare('UPDATE email_confirmations SET created_at = created_at - 120000').run(); // get past the one-a-minute limit
  r = await a.c.req('POST', '/api/app/email/change', { email: 'second@example.com', password: PW }); assert.equal(r.status, 200);
  assert.equal((await a.c.req('GET', '/api/app/me')).data.user.email, 'first@example.com');
  assert.equal((await new Client(srv.base).req('POST', '/api/app/confirm-email', { token: tokenOf('second@example.com') })).status, 200);
  const me = (await a.c.req('GET', '/api/app/me')).data.user; assert.equal(me.email, 'second@example.com'); assert.equal(me.emailVerified, true);
});

test('people from before the feature are never held back; Host can resend and mark confirmed (with a reason)', { skip: !sqlite && 'SQLite-only' }, async () => {
  const a = await signedIn('old@example.com', 'olga', 'Old Co');
  d.prepare("UPDATE account_users SET email_grandfathered = 1 WHERE username = 'olga'").run();
  const me = (await a.c.req('GET', '/api/app/me')).data.user; assert.equal(me.emailHeld, false, 'grandfathered'); assert.equal(me.emailBanner, true, 'but still invited to confirm');
  assert.equal((await addPerson(a.c, 'helper3')).status, 200);
  const acct = (await host.req('GET', '/api/host/accounts?q=old@example.com')).data[0];
  const det = (await host.req('GET', `/api/host/accounts/${acct.id}`)).data, u = det.users.find(x => x.username === 'olga'); assert.equal(!!u.email_verified_at, false);
  d.prepare('UPDATE email_confirmations SET created_at = created_at - 120000').run();
  assert.equal((await host.req('POST', `/api/host/accounts/${acct.id}/users/${u.id}/verify-resend`)).status, 200);
  assert.equal((await host.req('POST', `/api/host/accounts/${acct.id}/users/${u.id}/mark-verified`, { reason: '' })).status, 400);
  assert.equal((await host.req('POST', `/api/host/accounts/${acct.id}/users/${u.id}/mark-verified`, { reason: 'confirmed by phone' })).status, 200);
  assert.equal((await a.c.req('GET', '/api/app/me')).data.user.emailVerified, true);
});
