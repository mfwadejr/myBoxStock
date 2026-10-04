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
