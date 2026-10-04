// TEST / reseller-id — generated word-based Reseller IDs, two-box sign-in (and the old one-box still works), the same email under two
// resellers, and one reset email that lists a link for each reseller account on that mailbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

let srv, host;
const PW = 'Sup3rSecretPass!';
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
});
test.after(() => srv?.stop());
const signup = (c, biz, email, username) => c.req('POST', '/api/app/signup', { businessName: biz, email, username, password: PW });

test('new accounts get a generated word-based Reseller ID; sign in with two boxes or the older single box', async () => {
  const a = new Client(srv.base), r = await signup(a, 'Alpha Boxes', 'sam@example.com', 'sam');
  assert.equal(r.status, 200); assert.match(r.data.resellerId, /^[a-z]+-[a-z]+-\d{4}$/); assert.equal(r.data.username, 'sam');
  let s = await new Client(srv.base).req('POST', '/api/app/login', { resellerId: r.data.resellerId.toUpperCase(), username: ' SAM ', password: PW });
  assert.equal(s.status, 200, 'case and spaces do not matter');
  s = await new Client(srv.base).req('POST', '/api/app/login', { login: `sam@${r.data.resellerId}`, password: PW }); assert.equal(s.status, 200, 'the older single box still works');
  s = await new Client(srv.base).req('POST', '/api/app/login', { resellerId: r.data.resellerId, username: 'sam', password: 'Wrong-password-1' }); assert.equal(s.status, 401);
  s = await new Client(srv.base).req('POST', '/api/app/login', { resellerId: '', username: 'sam', password: PW }); assert.equal(s.status, 400);
});

test('the same username and email under two resellers: separate accounts, separate passwords; one reset email lists both', { skip: (process.env.DB_CLIENT || 'sqlite') !== 'sqlite' && 'SQLite-only (reads the mail queue file)' }, async () => {
  const x = (await signup(new Client(srv.base), 'Beta Boxes', 'two@example.com', 'pat')).data, y = (await signup(new Client(srv.base), 'Gamma Boxes', 'two@example.com', 'pat')).data;
  assert.notEqual(x.resellerId, y.resellerId);
  for (const id of [x.resellerId, y.resellerId]) assert.equal((await new Client(srv.base).req('POST', '/api/app/login', { resellerId: id, username: 'pat', password: PW })).status, 200);
  const c = new Client(srv.base);
  assert.deepEqual((await c.req('POST', '/api/app/forgot', { email: 'Two@Example.com' })).data, { ok: true });
  assert.deepEqual((await c.req('POST', '/api/app/forgot', { email: 'nobody@example.com' })).data, { ok: true }, 'same answer for an unknown address');
  await sleep(300);
  const { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db'));
  const q = d.prepare("SELECT subject, body_text FROM mail_queue WHERE to_addr = 'two@example.com'").all().filter(m => /Reset your/.test(m.subject));
  assert.equal(q.length, 1, 'one message, not one per account');
  const links = (q[0].body_text.match(/#\/reset\/[\w-]+/g) || []); assert.equal(links.length, 2);
  assert.ok(q[0].body_text.includes(x.resellerId) && q[0].body_text.includes(y.resellerId) && q[0].body_text.includes('Beta Boxes') && q[0].body_text.includes('Gamma Boxes'));
  // using one link changes only that reseller's password
  const tok = links[0].split('/').pop(), np = 'N3w-Password-4567';
  assert.equal((await c.req('POST', '/api/app/reset', { token: tok, password: np })).status, 200);
  const ok = [x, y].map(async a => (await new Client(srv.base).req('POST', '/api/app/login', { resellerId: a.resellerId, username: 'pat', password: np })).status === 200);
  assert.equal((await Promise.all(ok)).filter(Boolean).length, 1, 'exactly one of the two accounts has the new password');
});
