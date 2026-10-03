// CORE / ids — random identifiers and hashing helpers.
import crypto from 'node:crypto';

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 32);
export const token = (n = 32) => crypto.randomBytes(n).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Human-friendly public account ID without look-alike characters, e.g. BX-7K3QF9.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newAccountCode() {
  const b = crypto.randomBytes(6);
  return 'BX-' + [...b].map(x => ALPHA[x % ALPHA.length]).join('');
}
