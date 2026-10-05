// TEST / audit-trail — every kind of audit entry (firewall, bans and lockouts, Host Console sign-ins, two-factor, server options) is written, filterable, and free of reseller activity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, sleep } from './helpers.mjs';
import { totpCode } from '../src/auth/totp.mjs';
import { AUDIT_TYPES, AUDIT_GROUPS } from '../src/services/audit/types.mjs';

const PW = 'Sup3rSecretPass!', XFF = '198.51.100.7';
let srv, host;
test.before(async () => {
  srv = await startServer({ TRUST_PROXY: '1' }); host = new Client(srv.base); host.headers = { 'X-Forwarded-For': XFF };
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
});
test.after(() => srv?.stop());

// Entries are written a moment after the action: poll for up to about 5 seconds.
async function entry(match, query = '') {
  let rows = []; for (let i = 0; i < 25; i++) { rows = (await host.req('GET', '/api/host/audit' + query)).data.rows || []; const hit = rows.find(match); if (hit) return hit; await sleep(200); }
  assert.fail('no audit entry found; saw ' + JSON.stringify(rows.map(r => [r.event, r.message]).slice(0, 8)));
}
const other = (ip) => { const c = new Client(srv.base); c.headers = { 'X-Forwarded-For': ip }; return c; };

test('firewall rule added, changed and removed are recorded with who, what and from where', async () => {
  const id = (await host.req('POST', '/api/host/firewall/rules', { kind: 'deny', cidr: '203.0.113.0/24', note: 'test' })).data.id;
  let e = await entry(r => r.event === 'rule.added'); assert.equal(e.actor, 'admin'); assert.equal(e.ip, XFF); assert.equal(e.label, 'Firewall rule added'); assert.match(e.message, /203\.0\.113\.0\/24/);
  await host.req('POST', `/api/host/firewall/rules/${id}/toggle`, { enabled: false });
  e = await entry(r => r.event === 'rule.toggled'); assert.equal(e.actor, 'admin'); assert.equal(e.ip, XFF); assert.match(e.message, /203\.0\.113\.0\/24.*turned off/);
  await host.req('DELETE', `/api/host/firewall/rules/${id}`);
  e = await entry(r => r.event === 'rule.removed'); assert.equal(e.actor, 'admin'); assert.equal(e.label, 'Firewall rule removed');
});

test('rate-limit settings and the Host Console access limit are recorded', async () => {
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, authMaxAttempts: 1, banAfterViolations: 2, banMinutes: 15 });
  let e = await entry(r => r.event === 'limits.changed'); assert.equal(e.actor, 'admin'); assert.equal(e.ip, XFF);
  await host.req('POST', '/api/host/firewall/rules', { kind: 'host', cidr: XFF });
  assert.equal((await host.req('PUT', '/api/host/firewall/host-access', { enabled: true })).status, 200);
  e = await entry(r => r.event === 'host_access.changed'); assert.equal(e.actor, 'admin'); assert.match(e.message, /turned on/);
  await host.req('PUT', '/api/host/firewall/host-access', { enabled: false });
});

test('a ban created by the rate limiter and lifted by an administrator is recorded', async () => {
  const bad = other('203.0.113.9'); for (let i = 0; i < 4; i++) await bad.req('POST', '/api/app/login', { login: 'x@bx-aaaaaa', password: 'wrong-password-9' });
  let e = await entry(r => r.event === 'ban.created'); assert.equal(e.label, 'Ban created'); assert.equal(e.actor, null, 'automatic: no administrator'); assert.match(e.message, /203\.0\.113\.9/);
  await host.req('POST', '/api/host/firewall/unban', { ip: '203.0.113.9' });
  e = await entry(r => r.event === 'ban.lifted'); assert.equal(e.actor, 'admin'); assert.equal(e.ip, XFF); assert.match(e.message, /203\.0\.113\.9/);
  assert.ok((await host.req('GET', '/api/host/audit?type=blocks')).data.rows.every(r => ['ban.created', 'ban.lifted', 'lockout.started'].includes(r.event)));
  await host.req('PUT', '/api/host/firewall/limits', { enabled: false });
});

test('Host Console sign-in, failed sign-in, locked sign-in and sign-out are recorded; reseller sign-ins are not', async () => {
  const h2 = other('192.0.2.50');
  await h2.req('POST', '/api/host/login', { login: 'admin', password: 'wrong-password-1' });
  let e = await entry(r => r.event === 'login.failed'); assert.equal(e.label, 'Host Console failed sign-in'); assert.equal(e.ip, '192.0.2.50'); assert.match(e.message, /admin/);
  assert.equal((await h2.req('POST', '/api/host/login', { login: 'admin', password: PW })).status, 200);
  e = await entry(r => r.event === 'login.ok' && r.ip === '192.0.2.50'); assert.equal(e.actor, 'admin'); assert.equal(e.label, 'Host Console sign-in');
  await h2.req('POST', '/api/host/logout');
  e = await entry(r => r.event === 'logout' && r.ip === '192.0.2.50'); assert.equal(e.actor, 'admin'); assert.equal(e.label, 'Host Console sign-out');
  for (let i = 0; i < 6; i++) await other(`192.0.2.${60 + i}`).req('POST', '/api/host/login', { login: 'ghost', password: 'wrong-password-2' });
  e = await entry(r => r.event === 'lockout.started'); assert.equal(e.label, 'Host Console sign-in locked'); assert.match(e.message, /ghost/);
  await other('192.0.2.80').req('POST', '/api/app/login', { login: 'nobody@bx-bbbbbb', password: 'wrong-password-3' }); await sleep(800);
  const all = (await host.req('GET', '/api/host/audit?q=bx-bbbbbb')).data.rows; assert.equal(all.length, 0, 'reseller sign-ins are not part of the audit trail');
  assert.ok((await host.req('GET', '/api/host/audit?type=signins')).data.rows.every(r => ['login.ok', 'login.failed', 'login.blocked', 'mfa.failed', 'logout'].includes(r.event)));
});

test('two-factor turned on, used with a recovery code, and turned off are recorded', async () => {
  const h = other('192.0.2.90'); await h.req('POST', '/api/host/login', { login: 'admin', password: PW });
  const secret = (await h.req('POST', '/api/host/totp/setup')).data.secret;
  const codes = (await h.req('POST', '/api/host/totp/enable', { code: totpCode(secret) })).data.recoveryCodes;
  let e = await entry(r => r.event === 'mfa.enabled'); assert.equal(e.actor, 'admin'); assert.equal(e.label, 'Two-factor turned on'); assert.equal(e.ip, '192.0.2.90');
  const h3 = other('192.0.2.91'); await h3.req('POST', '/api/host/login', { login: 'admin', password: PW }); await h3.req('POST', '/api/host/login/mfa', { code: '000000' });
  e = await entry(r => r.event === 'mfa.failed'); assert.equal(e.actor, 'admin');
  assert.equal((await h3.req('POST', '/api/host/login/mfa', { code: codes[0] })).status, 200);
  e = await entry(r => r.event === 'mfa.recovery_used'); assert.equal(e.actor, 'admin'); assert.doesNotMatch(JSON.stringify(e), new RegExp(codes[0]));
  assert.equal((await h.req('POST', '/api/host/totp/disable', { password: PW, code: totpCode(secret) })).status, 200);
  e = await entry(r => r.event === 'mfa.disabled'); assert.equal(e.actor, 'admin'); assert.equal(e.label, 'Two-factor turned off');
});

test('server option changes are recorded with before and after, only when something changed', async () => {
  await host.req('PUT', '/api/host/settings', { runtime: { logRetentionDays: 30, trustProxy: '1' } });
  const e = await entry(r => r.event === 'settings.runtime'); assert.equal(e.actor, 'admin'); assert.equal(e.ip, XFF); assert.match(e.message, /logRetentionDays 90 -> 30/); assert.doesNotMatch(e.message, /trustProxy/, 'unchanged options are not listed');
  await host.req('PUT', '/api/host/settings', { runtime: { logRetentionDays: 7 } });
  await entry(r => /logRetentionDays 30 -> 7/.test(r.message));
});

test('every audit type has a group, and the type list is available to the page', async () => {
  const groups = (await host.req('GET', '/api/host/audit/types')).data; assert.deepEqual(groups.map(g => g.id), AUDIT_GROUPS.map(g => g.id));
  for (const t of AUDIT_TYPES) assert.ok(groups.some(g => g.id === t.group), t.label);
  assert.ok(AUDIT_TYPES.filter(t => /^backup\./.test(t.events[0])).every(t => t.group === 'backups') && groups.some(g => g.id === 'backups'), 'backup entries have their own Backups group');
});
