// SERVICES / demo / vault — runs the browser's own encryption code (public/js/shared/vault.js) on the server, so demo accounts hold real encrypted records the real app can open.
// The file is loaded unchanged into a sandbox and given the same Web Crypto the browser has; nothing here is a second copy of the encryption.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

let V;
export function demoVault() {
  if (V) return V;
  const file = path.join(path.resolve(import.meta.dirname, '..', '..', '..'), 'public', 'js', 'shared', 'vault.js');
  const sandbox = { crypto: globalThis.crypto, TextEncoder, TextDecoder, Uint8Array, btoa, atob, JSON, String, Error, Math, Promise };
  sandbox.globalThis = sandbox; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: 'vault.js' });
  V = sandbox.Vault;
  return V;
}
// Key work for demo logins uses the lowest iteration count the server accepts, so a set builds quickly. The browser reads the count stored with each key, so these open normally.
export const DEMO_ITERS = 100000;
