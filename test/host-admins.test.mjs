// TEST / host-admins — the Owner (first administrator) manages the others; helpers can only edit their own details.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from './helpers.mjs';
import { totpCode } from '../src/auth/totp.mjs';

const STRONG = 'Sup3rSecretPass!', HELPER = 'H3lperSecretPass!';
let srv, owner, helper;
test.before(async () => {
  srv = await startServer(); owner = new Client(srv.base);
  assert.equal((await owner.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw })).status, 200);
  await owner.req('POST', '/api/host/change-password', { current: srv.hostPw, next: STRONG });
});
test.after(() => srv?.stop());
const list = async (c) => (await c.req('GET', '/api/host/admins')).data;
const signIn = async (login, password, newPw) => { const c = new Client(srv.base); const r = await c.req('POST', '/api/host/login', { login, password }); assert.equal(r.status, 200); if (newPw) await c.req('POST', '/api/host/change-password', { current: password, next: newPw }); return c; };

test('the first administrator is the Owner; only the Owner can add others', async () => {
  let rows = await list(owner); assert.equal(rows.length, 1); assert.equal(rows[0].owner, true); assert.equal(rows[0].username, 'admin');
  assert.equal((await owner.req('POST', '/api/host/admins', { username: 'helper', email: 'helper@example.com', password: 'Temp0rarySecret!' })).status, 200);
  helper = await signIn('helper', 'Temp0rarySecret!', HELPER);
  rows = await list(owner); assert.equal(rows.find(a => a.username === 'helper').owner, false);
  assert.equal((await helper.req('POST', '/api/host/admins', { username: 'third', password: 'Temp0rarySecret!' })).status, 403, 'a helper cannot add administrators');
});

test('edit details: your own, or anyone\'s as Owner; helpers cannot edit others; input is checked', async () => {
  const rows = await list(owner), h = rows.find(a => a.username === 'helper'), o = rows.find(a => a.owner);
  assert.equal((await helper.req('PUT', `/api/host/admins/${h.id}`, { displayName: 'Hal Helper', email: 'hal@example.com', cell: '+1 (555) 010-2030' })).status, 200);
  let now = (await list(owner)).find(a => a.id === h.id); assert.deepEqual([now.display_name, now.email, now.cell], ['Hal Helper', 'hal@example.com', '+1 (555) 010-2030']);
  assert.equal((await helper.req('PUT', `/api/host/admins/${o.id}`, { displayName: 'Hacked' })).status, 403, 'a helper cannot edit the Owner');
  assert.equal((await owner.req('PUT', `/api/host/admins/${h.id}`, { displayName: 'Hal H.', email: 'hal@example.com', cell: '' })).status, 200, 'the Owner can edit anyone');
  assert.equal((await list(owner)).find(a => a.id === h.id).cell, null, 'an empty cell clears it');
  assert.equal((await owner.req('PUT', `/api/host/admins/${h.id}`, { email: 'nope' })).status, 400);
  assert.equal((await owner.req('PUT', `/api/host/admins/${h.id}`, { cell: 'call me' })).status, 400);
  assert.equal((await owner.req('PUT', `/api/host/admins/${h.id}`, { displayName: 'x'.repeat(101) })).status, 400);
  assert.equal((await owner.req('PUT', '/api/host/admins/missing', {})).status, 404);
});

test('Owner-only support actions: reset two-factor, temporary password, sign out, delete', async () => {
  const h = (await list(owner)).find(a => a.username === 'helper'), o = (await list(owner)).find(a => a.owner);
  const setup = await helper.req('POST', '/api/host/totp/setup'); assert.equal((await helper.req('POST', '/api/host/totp/enable', { code: totpCode(setup.data.secret) })).status, 200);
  assert.equal((await list(owner)).find(a => a.id === h.id).totp_enabled, 1);
  for (const [m, p] of [['POST', 'reset-mfa'], ['POST', 'temp-password'], ['POST', 'sign-out']]) assert.equal((await helper.req(m, `/api/host/admins/${o.id}/${p}`)).status, 403, `a helper cannot ${p}`);
  assert.equal((await helper.req('DELETE', `/api/host/admins/${o.id}`, { confirm: 'admin' })).status, 403);
  for (const p of ['reset-mfa', 'temp-password', 'sign-out']) assert.equal((await owner.req('POST', `/api/host/admins/${o.id}/${p}`)).status, 400, `the Owner cannot ${p} their own account here`);

  let r = await owner.req('POST', `/api/host/admins/${h.id}/reset-mfa`); assert.equal(r.status, 200);
  assert.equal((await list(owner)).find(a => a.id === h.id).totp_enabled, 0, 'two-factor is cleared');
  assert.equal((await helper.req('GET', '/api/host/dashboard')).status, 401, 'and they are signed out');
  const q = (await owner.req('GET', '/api/host/mail/queue')).data.queue; assert.ok(q.some(m => m.to_addr === 'hal@example.com' && /Two-factor authentication was reset/.test(m.subject)), 'they are told by email');

  r = await owner.req('POST', `/api/host/admins/${h.id}/temp-password`); assert.equal(r.status, 200); assert.ok(r.data.tempPassword.length >= 10);
  const c = new Client(srv.base); assert.equal((await c.req('POST', '/api/host/login', { login: 'helper', password: HELPER })).status, 401, 'the old password stops working');
  r = await c.req('POST', '/api/host/login', { login: 'helper', password: (await owner.req('POST', `/api/host/admins/${h.id}/temp-password`)).data.tempPassword }); assert.equal(r.status, 200); assert.equal(r.data.mustChange, true);
  assert.equal((await c.req('GET', '/api/host/dashboard')).status, 403, 'blocked until the password is changed');
  await c.req('POST', '/api/host/change-password', { current: 'x', next: HELPER });

});

test('sign out everywhere and delete (with typed confirmation); the last administrator stays', async () => {
  const h = (await list(owner)).find(a => a.username === 'helper');
  // give the helper a known password and an open session
  const tmp = (await owner.req('POST', `/api/host/admins/${h.id}/temp-password`)).data.tempPassword;
  const hc = await signIn('helper', tmp, HELPER); const hc2 = await signIn('helper', HELPER);
  assert.equal((await hc2.req('GET', '/api/host/dashboard')).status, 200);
  assert.equal((await owner.req('POST', `/api/host/admins/${h.id}/sign-out`)).status, 200);
  assert.equal((await hc2.req('GET', '/api/host/dashboard')).status, 401, 'signed out everywhere'); void hc;
  assert.equal((await owner.req('DELETE', `/api/host/admins/${h.id}`, { confirm: 'wrong' })).status, 400);
  assert.equal((await owner.req('DELETE', `/api/host/admins/${h.id}`, { confirm: 'helper' })).status, 200);
  assert.equal((await list(owner)).length, 1);
  assert.equal((await owner.req('DELETE', `/api/host/admins/${(await list(owner))[0].id}`, { confirm: 'admin' })).status, 400, 'not yourself / not the last one');
});
