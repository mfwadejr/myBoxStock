// AUTH / totp — RFC 6238 time-based one-time passwords (SHA-1, 6 digits, 30 s) and recovery codes.
import crypto from 'node:crypto';
import { sha256, token } from '../core/ids.mjs';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32encode(buf) {
  let bits = '', out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}
export function b32decode(str) {
  let bits = '';
  for (const ch of str.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(ch).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export const newTotpSecret = () => b32encode(crypto.randomBytes(20));
export function totpCode(secret, t = Date.now()) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(counter).digest(), o = h[h.length - 1] & 15;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0');
}
export function verifyTotp(secret, code, t = Date.now()) {
  code = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some(d => crypto.timingSafeEqual(Buffer.from(totpCode(secret, t + d * 30000)), Buffer.from(code)));
}
export const otpauthUri = (secret, label, issuer = 'myBoxStock') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;

export function newRecoveryCodes(n = 8) {
  const plain = Array.from({ length: n }, () => `${token(3).slice(0, 4)}-${token(3).slice(0, 4)}`.toLowerCase());
  return { plain, hashes: plain.map(sha256) };
}
