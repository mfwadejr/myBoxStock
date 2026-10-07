// TEST / terms — Terms and Privacy acceptance: required at sign-up, version and time stored, the Host sees it,
// existing accounts and new versions prompt Administrators once, and the legal pages come from one source (content/legal).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, Client, ROOT, sleep } from './helpers.mjs';
import { TERMS_VERSION } from '../src/services/legal/index.mjs';
import { load } from '../src/services/docs/index.mjs';

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
const signup = (extra, user = 'tess') => new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Terms Co', email: `${user}@example.com`, username: user, password: PW, ...extra });
const signIn = async (r, user) => { const c = new Client(srv.base); const l = await c.req('POST', '/api/app/login', { resellerId: r.resellerId, username: user, password: PW }); assert.equal(l.status, 200); return c; };

test('legal pages: four pages, one version that matches the constant, shown by the API and as plain pages', async () => {
  const pages = load('legal');
  assert.deepEqual(pages.map(p => p.slug), ['terms-of-service', 'privacy-policy', 'data-responsibility-and-acceptable-use', 'billing-trial-and-refund-terms']);
  for (const p of pages) { assert.equal(p.version, TERMS_VERSION, `${p.slug} carries the current version`); assert.match(p.effective, /^\d{4}-\d{2}-\d{2}$/); assert.ok(/DRAFT/.test(p.body), `${p.slug} is marked DRAFT`); }
  const api = await new Client(srv.base).req('GET', '/api/app/legal'); assert.equal(api.status, 200); assert.equal(api.data.pages.length, 4); assert.equal(api.data.pages[0].version, TERMS_VERSION);
  const one = await new Client(srv.base).req('GET', '/api/app/legal/privacy-policy'); assert.equal(one.status, 200); assert.ok(one.data.html.includes('DRAFT')); assert.ok(one.data.effective);
  const html = await (await fetch(`${srv.base}/legal/terms-of-service`)).text();
  assert.ok(html.includes('Terms of Service') && html.includes(`Version ${TERMS_VERSION}`) && html.includes('Effective 2026-10-07') && !/\sstyle=/.test(html), 'a plain page with version and date and no inline style');
  assert.equal((await fetch(`${srv.base}/legal/nope`)).status, 404);
  assert.equal((await new Client(srv.base).req('GET', '/api/app/public-config')).data.termsVersion, TERMS_VERSION);
  for (const f of fs.readdirSync(path.join(ROOT, 'content', 'legal'))) assert.ok(/^---\n[\s\S]*\nversion: /.test(fs.readFileSync(path.join(ROOT, 'content', 'legal', f), 'utf8')), `${f} has a version header`);
});

test('an account cannot be created until the Terms box is ticked, and a stale version is refused', async () => {
  for (const extra of [{ acceptTerms: false }, { acceptTerms: 'yes' }]) { const r = await signup(extra, 'nobox'); assert.equal(r.status, 400); assert.equal(r.data.code, 'TERMS_REQUIRED'); assert.match(r.data.error, /Terms of Service/); }
  const raw = await fetch(srv.base + '/api/app/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessName: 'Raw Co', email: 'raw@example.com', username: 'rawr', password: PW }) });
  assert.equal(raw.status, 400, 'a request that never mentions the Terms is refused too');
  const stale = await signup({ termsVersion: 'an-older-version' }, 'stale'); assert.equal(stale.status, 409); assert.equal(stale.data.code, 'TERMS_STALE');
  const accounts = (await host.req('GET', '/api/host/accounts')).data; assert.equal(accounts.filter(a => /nobox|raw|stale/.test(a.owner_email)).length, 0, 'nothing was created');
});

test('sign-up stores the accepted version and time, logs it, and the Host sees it on the account', async () => {
  const before = Date.now(), r = await signup({ termsVersion: TERMS_VERSION }); assert.equal(r.status, 200);
  const list = (await host.req('GET', '/api/host/accounts')).data, row = list.find(a => a.account_code === r.data.resellerId);
  await sleep(700);   // the event log is written in small batches
  const det = (await host.req('GET', `/api/host/accounts/${row.id}`)).data;
  assert.equal(det.terms.version, TERMS_VERSION); assert.equal(det.terms.outdated, false); assert.ok(det.terms.acceptedAt >= before - 1000 && det.terms.acceptedAt <= Date.now());
  assert.equal(det.account.terms_version, TERMS_VERSION);
  assert.ok(det.events.some(e => e.event === 'terms.accepted' && e.message.includes(TERMS_VERSION)), 'event log entry');
  const c = await signIn(r.data, 'tess'); const me = (await c.req('GET', '/api/app/me')).data.user; assert.equal(me.termsRequired, false); assert.equal(me.termsVersion, TERMS_VERSION);
  assert.notEqual((await c.req('GET', '/api/app/vault/records')).data.code, 'TERMS_ACCEPT_REQUIRED');
});

test('an existing account is asked once; a new version asks again; only Administrators are asked', { skip: !sqlite && 'direct database edit is SQLite only' }, async () => {
  const r = (await signup({}, 'olga')).data;
  const set = (v, at) => d.prepare('UPDATE accounts SET terms_version = ?, terms_accepted_at = ? WHERE account_code = ?').run(v, at, r.resellerId);
  set(null, null);   // an account that existed before the Terms were introduced
  const staffMade = await (await signIn(r, 'olga')).req('POST', '/api/app/users', { username: 'staffer', role: 'Standard', password: 'Temp-pass-12345' }); assert.equal(staffMade.status, 403, 'blocked until the Administrator accepts');
  const a = await signIn(r, 'olga');
  assert.equal((await a.req('GET', '/api/app/me')).data.user.termsRequired, true);
  const blocked = await a.req('GET', '/api/app/vault/records'); assert.equal(blocked.status, 403); assert.equal(blocked.data.code, 'TERMS_ACCEPT_REQUIRED');
  assert.equal((await a.req('GET', '/api/app/docs')).status, 200, 'documentation can still be read');
  assert.equal((await a.req('POST', '/api/app/terms/accept', { version: 'old' })).status, 409, 'must accept the current version');
  const ok = await a.req('POST', '/api/app/terms/accept', { version: TERMS_VERSION }); assert.equal(ok.status, 200);
  const row = d.prepare('SELECT terms_version, terms_accepted_at FROM accounts WHERE account_code = ?').get(r.resellerId); assert.equal(row.terms_version, TERMS_VERSION); assert.ok(Number(row.terms_accepted_at) > 0);
  assert.equal((await a.req('GET', '/api/app/me')).data.user.termsRequired, false);
  assert.notEqual((await a.req('GET', '/api/app/vault/records')).data.code, 'TERMS_ACCEPT_REQUIRED');
  const a2 = await signIn(r, 'olga'); assert.equal((await a2.req('GET', '/api/app/me')).data.user.termsRequired, false, 'next sign-in: not asked again');
  assert.equal((await a2.req('POST', '/api/app/users', { username: 'staffer', role: 'Standard', password: 'Temp-pass-12345' })).status, 200);
  // A Standard person is never asked, even when the account has to accept again.
  set('an-older-version', 1);
  const s = new Client(srv.base); assert.equal((await s.req('POST', '/api/app/login', { resellerId: r.resellerId, username: 'staffer', password: 'Temp-pass-12345' })).status, 200);
  assert.equal((await s.req('GET', '/api/app/me')).data.user.termsRequired, false); assert.notEqual((await s.req('GET', '/api/app/vault/records')).data.code, 'TERMS_ACCEPT_REQUIRED');
  assert.equal((await s.req('POST', '/api/app/terms/accept', { version: TERMS_VERSION })).status, 403, 'only an Administrator can accept');
  const again = await signIn(r, 'olga'); assert.equal((await again.req('GET', '/api/app/me')).data.user.termsRequired, true, 'a changed version asks again');
  const det = (await host.req('GET', `/api/host/accounts/${(await host.req('GET', '/api/host/accounts')).data.find(x => x.account_code === r.resellerId).id}`)).data;
  assert.equal(det.terms.outdated, true); assert.equal(det.terms.version, 'an-older-version');
});
