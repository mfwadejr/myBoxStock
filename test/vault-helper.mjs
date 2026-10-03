// TEST / vault-helper — plays the part of the browser: runs the real vault.js and talks to the vault API.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers.mjs';

globalThis.window ??= globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'public/js/shared/vault.js'), 'utf8'));
export const Vault = globalThis.Vault; Vault.ITERS = 100000;

// Turn on encryption for the account the client is signed in to. Returns the keys a browser would hold.
export async function enableVault(c, password) {
  const adk = await Vault.newAdk(), recovery = Vault.newRecoveryKey();
  const r = await c.req('POST', '/api/app/vault/enable', { keys: await Vault.keysFor(password, adk), recoveryWrappedAdk: await Vault.wrapWithRecovery(adk, recovery.text) });
  if (r.status !== 200) throw new Error('enable failed: ' + JSON.stringify(r.data));
  return { adk, recovery: recovery.text };
}
export async function putRecord(c, adk, type, obj, id = Vault.newId(), rev = 0) {
  const r = await c.req('POST', '/api/app/vault/batch', { puts: [{ id, type, rev, blob: await Vault.seal(adk, obj, id, type) }] });
  return { ...r, id };
}
export async function readRecords(c, adk) {
  const r = await c.req('GET', '/api/app/vault/records'); if (r.status !== 200) return { status: r.status, items: [] };
  return { status: 200, items: await Promise.all(r.data.records.map(async x => ({ id: x.id, type: x.type, rev: x.rev, data: await Vault.open(adk, x.blob, x.id, x.type) }))) };
}
// Sign-in as the browser does: password -> /me -> unwrap the account key.
export async function unlockFrom(c, password) {
  const me = await c.req('GET', '/api/app/me'); if (!me.data.vault?.keys) return null;
  try { return await Vault.unlock(password, me.data.vault.keys); } catch { return null; }
}
// Add a person the way the Team page does: their temporary password also wraps the account key.
export async function addUser(c, adk, body) { return c.req('POST', '/api/app/users', { ...body, keys: await Vault.keysFor(body.password, adk) }); }
