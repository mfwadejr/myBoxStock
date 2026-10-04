// CORE / ids — random identifiers and hashing helpers.
import crypto from 'node:crypto';

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 32);
export const token = (n = 32) => crypto.randomBytes(n).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Reseller ID: three easy-to-say parts, e.g. amber-fox-4271. Generated, never chosen, so it is unique and carries no business name.
// Older accounts keep their original ID (e.g. BX-4K7Q2M); both kinds are matched case-insensitively.
const COLORS = ['amber', 'azure', 'berry', 'bronze', 'coral', 'crimson', 'denim', 'ember', 'forest', 'golden', 'indigo', 'ivory', 'jade', 'lemon', 'lilac', 'maple', 'mint', 'misty', 'navy', 'olive', 'peach', 'plum', 'ruby', 'rusty', 'sandy', 'silver', 'sunny', 'teal', 'violet', 'willow'];
const ANIMALS = ['badger', 'bison', 'crane', 'dove', 'eagle', 'falcon', 'finch', 'fox', 'gecko', 'heron', 'ibis', 'jaguar', 'koala', 'lark', 'lynx', 'marten', 'newt', 'orca', 'otter', 'owl', 'panda', 'puffin', 'quail', 'raven', 'robin', 'seal', 'stork', 'swan', 'tiger', 'wren'];
export const RESERVED_IDS = ['admin', 'host', 'api', 'app', 'support', 'root', 'system', 'test', 'demo'];
export function newResellerId() {
  const pick = (list) => list[crypto.randomInt(list.length)];
  return `${pick(COLORS)}-${pick(ANIMALS)}-${crypto.randomInt(1000, 10000)}`;
}
