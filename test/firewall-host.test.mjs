// Host Console access list: its own rule kind, plain 404 for outsiders, lockout protection, emergency override.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from './helpers.mjs';

test('host console access list', async () => {
  const srv = await startServer({ TRUST_PROXY: '1' });
  try {
    const host = new Client(srv.base); host.headers = { 'X-Forwarded-For': '203.0.113.5' };
    const login = await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
    assert.equal(login.status, 200);
    const STRONG = 'Str0ng-Pass-9876';
    assert.equal((await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: STRONG })).status, 200);
    let r = await host.req('PUT', '/api/host/firewall/host-access', { enabled: true });
    assert.equal(r.status, 400, 'cannot switch on without your own address listed');
    r = await host.req('POST', '/api/host/firewall/rules', { kind: 'host', cidr: '203.0.113.5', note: 'me' }); assert.equal(r.status, 200);
    const id = r.data.id;
    r = await host.req('PUT', '/api/host/firewall/host-access', { enabled: true }); assert.equal(r.status, 200);
    r = await host.req('POST', `/api/host/firewall/rules/${id}/toggle`, { enabled: false }); assert.equal(r.status, 400, 'cannot disable the rule that lets you in');
    r = await host.req('DELETE', `/api/host/firewall/rules/${id}`); assert.equal(r.status, 400, 'cannot delete the rule that lets you in');
    const other = await fetch(`${srv.base}/api/host/me`, { headers: { 'X-Forwarded-For': '198.51.100.9' } });
    assert.equal(other.status, 404);
    assert.equal(await other.text(), 'Not Found');
    const pub = await fetch(`${srv.base}/`, { headers: { 'X-Forwarded-For': '198.51.100.9' } });
    assert.notEqual(pub.status, 404, 'the public site is not affected');
    r = await host.req('PUT', '/api/host/firewall/host-access', { enabled: false }); assert.equal(r.status, 200);
    const open = await fetch(`${srv.base}/api/host/me`, { headers: { 'X-Forwarded-For': '198.51.100.9' } });
    assert.notEqual(open.status, 404);
  } finally { srv.stop(); }
});

test('page files (css, js, assets) are not counted by the request limit while API calls still are', async () => {
  const srv = await startServer({ TRUST_PROXY: '1' }), ip = { 'X-Forwarded-For': '203.0.113.77' }, admin = { 'X-Forwarded-For': '203.0.113.5' };
  try {
    const host = new Client(srv.base); host.headers = admin;
    await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: 'Str0ng-Pass-9876' });
    assert.equal((await host.req('PUT', '/api/host/firewall/limits', { enabled: true, windowSec: 60, maxRequests: 20, authMaxAttempts: 10, authWindowSec: 300, banAfterViolations: 100, banMinutes: 1 })).status, 200);
    // a reload loop: 60 page loads of ~70 files each from one address, all served
    const files = ['/css/tokens.css', '/js/shared/core.js', '/assets/logo-512.png'], codes = new Set();
    for (let i = 0; i < 200; i++) codes.add((await fetch(srv.base + files[i % 3], { headers: ip })).status);
    assert.deepEqual([...codes], [200], 'static files are never limited');
    // the same address still gets limited on API calls, and on the page addresses themselves
    const api = []; for (let i = 0; i < 40; i++) api.push((await fetch(srv.base + '/api/app/me', { headers: ip })).status);
    assert.ok(api.includes(429), 'API calls are still counted: ' + [...new Set(api)]);
    assert.equal((await fetch(srv.base + '/css/tokens.css', { headers: ip })).status, 200, 'and static files still load for an address that hit the limit');
    const r = await host.req('GET', '/api/host/firewall'); assert.ok(r.data.stats.limited >= 1);
  } finally { srv.stop(); }
});
