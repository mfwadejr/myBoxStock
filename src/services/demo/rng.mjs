// SERVICES / demo / rng — a small seeded random generator, so the same seed always makes the same demo data (names, sizes, dates, prices).
import crypto from 'node:crypto';

// A number from any text: the seed of one account's generator.
export const seedOf = (...parts) => crypto.createHash('sha256').update(parts.join(':')).digest().readUInt32LE(0);
// mulberry32: tiny, fast and good enough for made-up data.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),                 // lo..hi inclusive
    pick: (list) => list[Math.floor(next() * list.length)],
    // weights: { key: number } -> a key, in proportion
    weighted: (weights) => { const e = Object.entries(weights).filter(([, w]) => w > 0), sum = e.reduce((t, [, w]) => t + w, 0); if (!sum) return e[0]?.[0] ?? null; let x = next() * sum; for (const [k, w] of e) { if ((x -= w) < 0) return k; } return e[e.length - 1][0]; },
    hex: (n) => Array.from({ length: n }, () => '0123456789ABCDEF'[Math.floor(next() * 16)]).join(''),
  };
  return r;
}
// A stable id from text (the account and record ids): the same seed gives the same ids.
export const stableId = (...parts) => crypto.createHash('sha256').update(parts.join(':')).digest('base64url').slice(0, 22);
export const stableHex = (...parts) => crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
