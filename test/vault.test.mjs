// TEST / vault — the server stores only ciphertext; keys, recovery, team hand-over, password changes and conflicts behave.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, Client } from './helpers.mjs';
import { Vault, enableVault, putRecord, readRecords, unlockFrom } from './vault-helper.mjs';

let srv, host, admin, other, keys, login, accId;
const PW = 'Sup3rSecretPass!', SECRET = 'MY-VERY-SECRET-DEVICE-UID-4471', CUSTOMER = 'Zelda Fitzgerald';
const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let ipn = 1; const mk = () => { const c = new Client(srv.base); c.headers = { 'X-Forwarded-For': `10.9.${ipn++}.1` }; return c; }; // each pretend browser has its own address, so rate limits are not hit
test.before(async () => { srv = await startServer({ TRUST_PROXY: '1' }); host = mk(); admin = mk(); other = mk(); });
test.after(() => srv?.stop());

test('setup: account created, encryption turned on once, recovery key works', async () => {
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  let r = await admin.req('POST', '/api/app/signup', { businessName: 'Vault Co', email: 'v@example.com', username: 'val', password: PW }); login = r.data.login; accId = r.data.accountCode;
  await admin.req('POST', '/api/app/login', { login, password: PW });
  r = await admin.req('GET', '/api/app/me'); assert.equal(r.data.vault.enabled, false);
  assert.equal((await admin.req('GET', '/api/app/vault/records')).status, 409, 'no data access before setup');
  keys = await enableVault(admin, PW);
  assert.equal((await admin.req('POST', '/api/app/vault/enable', { keys: await Vault.keysFor(PW, keys.adk), recoveryWrappedAdk: await Vault.wrapWithRecovery(keys.adk, keys.recovery) })).status, 409);
  assert.equal((await admin.req('POST', '/api/app/vault/enable', { keys: { salt: 'x' }, recoveryWrappedAdk: 'no' })).status, 400);
  r = await admin.req('GET', '/api/app/me'); assert.equal(r.data.vault.enabled, true); assert.ok(r.data.vault.keys.wrappedAdk);
  assert.ok(await unlockFrom(admin, PW), 'password unlocks'); assert.equal(await unlockFrom(admin, 'Not-the-password-1'), null, 'wrong password does not');
  const rec = await admin.req('GET', '/api/app/vault/recovery'); const viaRecovery = await Vault.unwrapWithRecovery(rec.data.wrappedAdk, keys.recovery.toLowerCase());
  const p = await putRecord(admin, keys.adk, 'item', { uid: SECRET, model: 'V6' }); assert.equal(p.status, 200);
  assert.equal((await readRecords(admin, viaRecovery)).items[0].data.uid, SECRET, 'recovery key opens the same data');
});

test('the server and the host never see plaintext', async () => {
  await putRecord(admin, keys.adk, 'customer', { name: CUSTOMER, phone: '555-0199' });
  const raw = (await admin.req('GET', '/api/app/vault/records')).data.records; assert.equal(raw.length, 2);
  for (const x of raw) assert.ok(!x.blob.includes(SECRET) && !x.blob.includes('Zelda') && !Buffer.from(x.blob.split('.')[2], 'base64').includes(SECRET));
  const acc = (await host.req('GET', '/api/host/accounts')).data.find(a => a.account_code === accId);
  const d = (await host.req('GET', `/api/host/accounts/${acc.id}`)).data; assert.deepEqual(d.data, { encrypted: true, recordCount: 2 });
  const hostBlob = JSON.stringify([d, (await host.req('GET', '/api/host/logs?limit=500')).data]); assert.ok(!hostBlob.includes(SECRET) && !hostBlob.includes('Zelda'));
  if (sqlite) { await new Promise(r => setTimeout(r, 300)); for (const f of fs.readdirSync(srv.dir).filter(f => f.startsWith('myboxstock.db'))) assert.ok(!fs.readFileSync(path.join(srv.dir, f)).includes(SECRET), `${f} has no plaintext`); }
});

test('a record cannot be moved to another id or type, and tampering is detected', async () => {
  const rec = (await admin.req('GET', '/api/app/vault/records')).data.records.find(x => x.type === 'item');
  await assert.rejects(Vault.open(keys.adk, rec.blob, 'someotherid', 'item')); await assert.rejects(Vault.open(keys.adk, rec.blob, rec.id, 'customer'));
  const bad = rec.blob.slice(0, -6) + 'AAAAAA'; await assert.rejects(Vault.open(keys.adk, bad, rec.id, 'item'));
});

test('edits use the revision they read: a stale save is refused and nothing partial is kept', async () => {
  const { id } = await putRecord(admin, keys.adk, 'item', { uid: 'V1' });
  let r = await putRecord(admin, keys.adk, 'item', { uid: 'V1b' }, id, 1); assert.equal(r.status, 200);
  r = await putRecord(admin, keys.adk, 'item', { uid: 'V1c' }, id, 1); assert.equal(r.status, 409); assert.equal(r.data.code, 'RECORD_CONFLICT');
  const ok = Vault.newId(), blob = await Vault.seal(keys.adk, { uid: 'NEW' }, ok, 'item'), stale = await Vault.seal(keys.adk, { uid: 'x' }, id, 'item');
  r = await admin.req('POST', '/api/app/vault/batch', { puts: [{ id: ok, type: 'item', rev: 0, blob }, { id, type: 'item', rev: 1, blob: stale }] }); assert.equal(r.status, 409);
  assert.ok(!(await readRecords(admin, keys.adk)).items.some(x => x.id === ok), 'first put was rolled back');
  r = await admin.req('POST', '/api/app/vault/batch', { deletes: [{ id }] }); assert.equal(r.status, 200);
  assert.ok(!(await readRecords(admin, keys.adk)).items.some(x => x.id === id));
});

test('other accounts cannot read, change or delete these records', async () => {
  await other.req('POST', '/api/app/signup', { businessName: 'Other', email: 'o@example.com', username: 'olive', password: PW });
  const o = (await host.req('GET', '/api/host/accounts')).data.find(a => a.business_name === 'Other');
  await other.req('POST', '/api/app/login', { login: `olive@${o.account_code.toLowerCase()}`, password: PW }); const ok = await enableVault(other, PW);
  assert.equal((await readRecords(other, ok.adk)).items.length, 0);
  const mine = (await admin.req('GET', '/api/app/vault/records')).data.records[0];
  assert.equal((await other.req('POST', '/api/app/vault/batch', { deletes: [{ id: mine.id }] })).status, 200);
  assert.ok((await admin.req('GET', '/api/app/vault/records')).data.records.some(x => x.id === mine.id), 'still there');
  const r = await other.req('POST', '/api/app/vault/batch', { puts: [{ id: mine.id, type: 'item', rev: mine.rev, blob: mine.blob }] }); assert.equal(r.status, 409);
});

test('team hand-over: new person unlocks with the temporary password and keeps access after changing it', async () => {
  const temp = 'Temp-pass-12345', ks = await Vault.keysFor(temp, keys.adk);
  let r = await admin.req('POST', '/api/app/users', { username: 'stan', email: 's@example.com', role: 'Standard', password: temp, keys: ks }); assert.equal(r.status, 200);
  const stan = mk(); r = await stan.req('POST', '/api/app/login', { login: r.data.login, password: temp }); assert.equal(r.data.mustChange, true);
  const adk = await unlockFrom(stan, temp); assert.ok(adk, 'unlocked while changing the password');
  const next = 'Brand-new-pass-678';
  assert.equal((await stan.req('POST', '/api/app/change-password', { current: temp, next })).status, 400, 'a password change without re-wrapped keys is refused');
  r = await stan.req('POST', '/api/app/change-password', { current: temp, next, keys: await Vault.keysFor(next, adk) }); assert.equal(r.status, 200);
  const again = mk(); await again.req('POST', '/api/app/login', { login: `stan@${accId.toLowerCase()}`, password: next });
  assert.equal(await unlockFrom(again, temp), null); const a2 = await unlockFrom(again, next); assert.ok(a2);
  assert.ok((await readRecords(again, a2)).items.length >= 1, 'Standard sees items/customers');
  // Standard cannot write what View cannot, but can write sales; role limits are enforced per record type
  assert.equal((await putRecord(again, a2, 'sale', { total: 5 })).status, 200);
  const view = await admin.req('POST', '/api/app/users', { username: 'vic', role: 'View', password: temp, keys: ks }); const vc = mk();
  await vc.req('POST', '/api/app/login', { login: view.data.login, password: temp }); const va = await unlockFrom(vc, temp);
  assert.equal((await putRecord(vc, va, 'sale', { total: 1 })).status, 403);
  const own = await Vault.keysFor(next, va);
  assert.equal((await vc.req('POST', '/api/app/change-password', { current: temp, next, keys: own })).status, 200);
});

test('setup (field and checklist configuration): everyone can read it, only Administrators can change it', async () => {
  const cfg = { fields: [{ key: 'uid', label: 'UID' }], steps: [] }, id = 'config-inventory';
  assert.equal((await putRecord(admin, keys.adk, 'config', cfg, id)).status, 200);
  const temp = 'Temp-pass-12345', c = mk(); let r = await admin.req('POST', '/api/app/users', { username: 'cora', email: 'c@example.com', role: 'Standard', password: temp, keys: await Vault.keysFor(temp, keys.adk) });
  await c.req('POST', '/api/app/login', { login: r.data.login, password: temp }); const next = 'Brand-new-pass-678', adk = await unlockFrom(c, temp);
  await c.req('POST', '/api/app/change-password', { current: temp, next, keys: await Vault.keysFor(next, adk) });
  assert.ok((await readRecords(c, adk)).items.some(x => x.type === 'config'), 'a Standard user can read the setup');
  assert.equal((await putRecord(c, adk, 'config', { ...cfg, steps: [{ key: 'x', label: 'x' }] }, id, 1)).status, 403, 'but cannot change it');
  assert.equal((await putRecord(admin, keys.adk, 'config', { ...cfg, steps: [{ key: 'x', label: 'x' }] }, id, 1)).status, 200);
});

test('forgotten password: link reset removes the old key; the recovery key or an Administrator restores access', async () => {
  const temp = 'Temp-pass-12345';
  let r = await admin.req('POST', '/api/app/users', { username: 'lou', email: 'l@example.com', role: 'Standard', password: temp, keys: await Vault.keysFor(temp, keys.adk) });
  const lc = `lou@${accId.toLowerCase()}`, lou = mk(); await lou.req('POST', '/api/app/login', { login: lc, password: temp });
  const acc = (await host.req('GET', '/api/host/accounts')).data.find(a => a.account_code === accId), det = (await host.req('GET', `/api/host/accounts/${acc.id}`)).data;
  // Administrator gives a new temporary password with fresh access
  const t2 = 'Another-temp-9876'; r = await admin.req('POST', `/api/app/users/${det.users.find(u => u.username === 'lou').id}/reset-access`, { password: t2 }); assert.equal(r.status, 400, 'keys are required in an encrypted account');
  r = await admin.req('POST', `/api/app/users/${det.users.find(u => u.username === 'lou').id}/reset-access`, { password: t2, keys: await Vault.keysFor(t2, keys.adk) }); assert.equal(r.status, 200);
  assert.equal((await lou.req('GET', '/api/app/me')).status, 401, 'old sessions ended');
  const l2 = mk(); await l2.req('POST', '/api/app/login', { login: lc, password: t2 }); assert.ok(await unlockFrom(l2, t2));
  // Recovery after a password was reset by email: the key row is gone, the recovery key re-wraps under the new password
  const uid = det.users.find(u => u.username === 'lou').id; const sqliteDb = sqlite && (await import('node:sqlite')).DatabaseSync;
  if (sqlite) { const d = new sqliteDb(path.join(srv.dir, 'myboxstock.db')); d.prepare('DELETE FROM account_keys WHERE user_id = ?').run(uid); d.prepare('UPDATE account_users SET must_change = 0 WHERE id = ?').run(uid); d.close(); } // an emailed-link reset leaves the person with no key row

  if (sqlite) {
    const l3 = mk(); r = await l3.req('POST', '/api/app/login', { login: lc, password: t2 }); const me = await l3.req('GET', '/api/app/me'); assert.equal(me.data.vault.keys, null);
    const wrapped = (await l3.req('GET', '/api/app/vault/recovery')).data.wrappedAdk, adk = await Vault.unwrapWithRecovery(wrapped, keys.recovery);
    assert.equal((await l3.req('PUT', '/api/app/vault/keys/me', { keys: await Vault.keysFor(t2, adk) })).status, 200); assert.ok(await unlockFrom(l3, t2));
  }
});

test('replacing the recovery key makes the old one useless', async () => {
  const fresh = Vault.newRecoveryKey();
  assert.equal((await admin.req('POST', '/api/app/vault/recovery/rotate', { recoveryWrappedAdk: await Vault.wrapWithRecovery(keys.adk, fresh.text) })).status, 200);
  const w = (await admin.req('GET', '/api/app/vault/recovery')).data.wrappedAdk;
  await assert.rejects(Vault.unwrapWithRecovery(w, keys.recovery)); assert.ok(await Vault.unwrapWithRecovery(w, fresh.text));
  assert.equal((await admin.req('POST', '/api/app/vault/recovery/confirm')).status, 200);
});

test('accounts from before encryption can move their old items over', { skip: !sqlite && 'direct SQLite edit' }, async () => {
  const s = mk(), { DatabaseSync } = await import('node:sqlite');
  let r = await s.req('POST', '/api/app/signup', { businessName: 'Old Co', email: 'old@example.com', username: 'ola', password: PW }); await s.req('POST', '/api/app/login', { login: r.data.login, password: PW });
  const acc = (await host.req('GET', '/api/host/accounts')).data.find(a => a.business_name === 'Old Co');
  const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.prepare("INSERT INTO inventory_items (id, account_id, uid, model, status, created_at) VALUES ('old1', ?, 'OLD-UID-1', 'V6', 'available', 1)").run(acc.id); d.close();
  assert.equal((await s.req('GET', '/api/app/me')).data.vault.legacyItems, 1);
  const legacy = (await s.req('GET', '/api/app/vault/legacy')).data; assert.equal(legacy[0].uid, 'OLD-UID-1');
  const k = await enableVault(s, PW); assert.equal((await putRecord(s, k.adk, 'item', { uid: legacy[0].uid, model: legacy[0].model })).status, 200);
  assert.equal((await s.req('POST', '/api/app/vault/legacy/clear')).status, 200); assert.deepEqual((await s.req('GET', '/api/app/vault/legacy')).data, []);
});
