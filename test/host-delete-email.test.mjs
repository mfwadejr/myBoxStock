// TEST / host-delete-email — a Host-initiated delete sends ONE "account erased" email after the delete (owner + Administrators, optional reason),
// never waits on it, records "email not sent" in the audit trail when it cannot be sent, and is never sent a second time by the closing sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let srv, host, d;
test.before(async () => {
  srv = await startServer({ CLOSING_SWEEP_MS: '400' }); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
  if (sqlite) { const { DatabaseSync } = await import('node:sqlite'); d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000'); }
});
test.after(() => srv?.stop());
async function mk(biz, user, email) {
  const r = (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: biz, email, username: user, password: PW })).data;
  const c = new Client(srv.base); await c.req('POST', '/api/app/login', { resellerId: r.resellerId, username: user, password: PW });
  return { ...r, c, email };
}
const idOf = async (code) => (await host.req('GET', '/api/host/accounts')).data.find(x => x.account_code === code)?.id;
const mails = (to) => d.prepare('SELECT to_addr, subject, body_text, status FROM mail_queue WHERE to_addr = ?').all(to);
const deletedMails = (to) => mails(to).filter(m => /was deleted/.test(m.subject));
const audit = async (code) => (await host.req('GET', `/api/host/audit?q=${code}`)).data.rows;
const smtpOn = () => host.req('PUT', '/api/host/mail', { enabled: true, mode: 'smtp', fromName: 'T', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', port: 1, user: '', pass: '', secure: false } });

test('email not set up: the delete still works, nothing is queued, the audit trail says why, and the account detail reports it for the red warning', { skip: !sqlite && 'SQLite-only' }, async () => {
  const a = await mk('NoMail Co', 'nora', 'nora@example.com'), id = await idOf(a.resellerId);
  assert.equal((await host.req('GET', `/api/host/accounts/${id}`)).data.mailReady, false, 'the sheet warns when email is not set up');
  const r = await host.req('DELETE', `/api/host/accounts/${id}`, { confirm: a.resellerId, reason: 'Duplicate account' });
  assert.equal(r.status, 200); assert.equal(r.data.emailSent, false); assert.equal(r.data.emailNotSentBecause, 'no email configured');
  assert.equal(await idOf(a.resellerId), undefined, 'the account is gone');
  assert.equal(deletedMails('nora@example.com').length, 0, 'no "account erased" email was queued');
  let e; for (let i = 0; i < 20 && !e; i++) { e = (await audit(a.resellerId)).find(x => x.event === 'account.deleted'); if (!e) await sleep(250); }
  assert.ok(e && /deleted, email not sent: no email configured/.test(e.message) && /Duplicate account/.test(e.message), JSON.stringify(e));
});

test('email set up: one email per address after the delete, with the reason; a failing mail server never blocks the delete and the audit says so', { skip: !sqlite && 'SQLite-only' }, async () => {
  assert.equal((await smtpOn()).status, 200);
  const a = await mk('Mail Co', 'mia', 'owner@mail-co.example'), id = await idOf(a.resellerId);
  d.prepare('UPDATE account_users SET email_verified_at = ? WHERE account_id = ?').run(Date.now(), id);
  assert.equal((await a.c.req('POST', '/api/app/users', { username: 'second', email: 'second@mail-co.example', role: 'Administrator', password: 'Temp-pass-12345' })).status, 200);
  assert.equal((await a.c.req('POST', '/api/app/users', { username: 'staffer', email: 'staff@mail-co.example', role: 'Standard', password: 'Temp-pass-12345' })).status, 200);
  assert.equal((await host.req('GET', `/api/host/accounts/${id}`)).data.mailReady, true);
  const t0 = Date.now();
  const r = await host.req('DELETE', `/api/host/accounts/${id}`, { confirm: a.resellerId, reason: 'Requested by the owner' });
  assert.equal(r.status, 200); assert.equal(r.data.emailSent, true); assert.ok(Date.now() - t0 < 5000, 'the delete did not wait for delivery');
  assert.equal(await idOf(a.resellerId), undefined);
  const all = d.prepare("SELECT to_addr, subject, body_text FROM mail_queue WHERE subject LIKE ?").all(`%${a.resellerId}% was deleted`);
  assert.deepEqual(all.map(m => m.to_addr).sort(), ['owner@mail-co.example', 'second@mail-co.example'], 'owner and Administrators once each, not the Standard user');
  assert.ok(all.every(m => /deleted by the site/.test(m.body_text) && /Reason given: Requested by the owner/.test(m.body_text) && /Host cannot recover/.test(m.body_text)));
  let fail; for (let i = 0; i < 30 && !fail; i++) { await sleep(300); fail = (await audit(a.resellerId)).find(x => x.event === 'account.erase_email_failed'); }
  assert.ok(fail && /deleted, email not sent:/.test(fail.message), 'the failed delivery is written to the audit trail');
  assert.ok(deletedMails('owner@mail-co.example').every(m => m.status === 'failed'), 'one attempt only, no repeat sends');
  assert.ok((await audit(a.resellerId)).find(x => x.event === 'account.deleted' && /email queued to 2 addresses/.test(x.message)));
});

test('the closing sweep never sends a second email for an account a Host administrator deleted', { skip: !sqlite && 'SQLite-only' }, async () => {
  const a = await mk('Closing Mail Co', 'cleo', 'cleo@closing-mail.example'), id = await idOf(a.resellerId);
  assert.equal((await a.c.req('POST', '/api/app/account/close', { password: PW, resellerId: a.resellerId })).status, 200);
  d.prepare('UPDATE accounts SET closing_at = ? WHERE id = ?').run(Date.now() + 60e3, id);
  assert.equal((await host.req('DELETE', `/api/host/accounts/${id}`, { confirm: a.resellerId })).status, 200);
  d.prepare('UPDATE accounts SET closing_at = ? WHERE account_code = ?').run(Date.now() - 1000, a.resellerId);   // no such row any more: nothing for the sweep to find
  await sleep(1500);
  const m = mails('cleo@closing-mail.example'); assert.equal(m.filter(x => /was deleted/.test(x.subject)).length, 1, 'one Host-delete email');
  assert.equal(m.filter(x => /has been erased/.test(x.subject)).length, 0, 'no sweep email');
  // and the sweep still sends its own email for an account it erases itself
  const b = await mk('Sweep Co', 'sven', 'sven@sweep.example'); await b.c.req('POST', '/api/app/account/close', { password: PW, resellerId: b.resellerId });
  d.prepare('UPDATE accounts SET closing_at = ? WHERE account_code = ?').run(Date.now() - 1000, b.resellerId); await sleep(1500);
  assert.equal(mails('sven@sweep.example').filter(x => /has been erased/.test(x.subject)).length, 1);
});
