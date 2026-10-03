// AUTH / password — salted scrypt hashing and the password policy.
import crypto from 'node:crypto';

const PARAMS = { N: 16384, r: 8, p: 1 };
export const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'; // compared against when a user doesn't exist (timing parity)

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${crypto.scryptSync(pw, salt, 64, PARAMS).toString('base64')}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [alg, s, h] = stored.split('$');
    if (alg !== 'scrypt') return false;
    const dk = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 64, PARAMS), want = Buffer.from(h, 'base64');
    return want.length === dk.length && crypto.timingSafeEqual(dk, want);
  } catch { return false; }
}
export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Password must be at least 10 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must include letters and numbers.';
  return null;
}
