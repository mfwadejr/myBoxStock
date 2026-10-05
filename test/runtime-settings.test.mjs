// TEST / runtime-settings — server options saved in the Host Console win over the environment, are checked, and can be reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from './helpers.mjs';

const PW = 'Sup3rSecretPass!';
let srv, host;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
});
test.after(() => srv?.stop());
const get = async () => (await host.req('GET', '/api/host/settings')).data.runtime;
const put = (runtime) => host.req('PUT', '/api/host/settings', { runtime });

test('server options: default, save, validation, https-only cookie switch, reset', async () => {
  let r = await get(); assert.equal(r.logLevel.saved, false); assert.equal(r.trustProxy.saved, false);
  assert.equal((await put({ logLevel: 'warn', logRetentionDays: 30, trustProxy: '1' })).status, 200);
  r = await get(); assert.equal(r.logLevel.value, 'warn'); assert.equal(r.logLevel.saved, true); assert.equal(r.logRetentionDays.value, 30); assert.equal(r.trustProxy.value, '1');
  assert.equal((await put({ logLevel: 'loud' })).status, 400);
  assert.equal((await put({ logRetentionDays: 2 })).status, 400);
  assert.equal((await put({ trustProxy: '9' })).status, 400);
  const c = await put({ secureCookies: true }); assert.equal(c.status, 400, 'cannot be turned on from a plain http page'); assert.match(c.data.error, /https/);
  assert.equal((await put({ logLevel: null, logRetentionDays: null, trustProxy: null })).status, 200);
  r = await get(); assert.equal(r.logLevel.saved, false); assert.equal(r.logLevel.value, 'info'); assert.equal(r.trustProxy.value, '');
});

test('a proxy value set by the container that the menu cannot show is reported as custom, is kept when other options are saved, and is replaced only by an explicit choice', async () => {
  const s2 = await startServer({ TRUST_PROXY: 'loopback' }), h = new Client(s2.base);
  try {
    await h.req('POST', '/api/host/login', { login: 'admin', password: s2.hostPw }); await h.req('POST', '/api/host/change-password', { current: s2.hostPw, next: PW });
    const st = async () => (await h.req('GET', '/api/host/settings')).data.runtime.trustProxy, p2 = (runtime) => h.req('PUT', '/api/host/settings', { runtime });
    let t = await st(); assert.equal(t.value, 'loopback'); assert.equal(t.custom, true); assert.equal(t.saved, false);
    assert.equal((await p2({ logLevel: 'warn' })).status, 200); t = await st(); assert.equal(t.value, 'loopback', 'saving other options leaves it alone'); assert.equal(t.saved, false);
    assert.equal((await p2({ trustProxy: 'loopback', logLevel: 'info' })).status, 200); t = await st(); assert.equal(t.value, 'loopback'); assert.equal(t.saved, false, 'sending the value already in force changes nothing');
    assert.equal((await p2({ trustProxy: 'bogus' })).status, 400, 'other unknown values are still refused');
    assert.equal((await p2({ trustProxy: '1' })).status, 200); t = await st(); assert.equal(t.value, '1'); assert.equal(t.saved, true); assert.equal(t.custom, false); assert.equal(t.env, 'loopback');
    assert.equal((await p2({ trustProxy: null })).status, 200); t = await st(); assert.equal(t.value, 'loopback'); assert.equal(t.custom, true, 'reset falls back to the container value');
  } finally { s2.stop(); }
});
