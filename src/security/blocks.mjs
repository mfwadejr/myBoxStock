// SECURITY / blocks — keeps active sign-in lockouts, IP bans and their failure counters in the database so a restart does not undo them.
// The hot path (is this address banned? is this name locked?) stays in memory; this file only writes through and loads at start.
// Per-request rate-limit counters (requests per minute) stay in memory on purpose: they are short-lived and a restart resets them harmlessly.
import { newId } from '../core/ids.mjs';
import { areaLogger } from '../logging/logger.mjs';

const L = areaLogger('security');
let db = null, chain = Promise.resolve();
const COUNTER_MS = 3600e3; // failure/violation counters are remembered for an hour after the last one

// Writes happen one after another so two quick changes to the same key cannot collide on the unique index.
const queue = (fn) => { chain = chain.then(fn).catch((e) => L.error('blocks.write_failed', `Could not save a lockout or ban to the database: ${e.message}`)); return chain; };

export const COUNTER_TTL = COUNTER_MS;
export function saveBlock(kind, subject, { hits = 0, reason = '', expires }) {
  if (!db) return Promise.resolve();
  return queue(async () => {
    await db.run('DELETE FROM security_blocks WHERE kind = ? AND subject = ?', [kind, subject]);   // delete + insert is portable (no vendor upsert)
    await db.run('INSERT INTO security_blocks (id, kind, subject, hits, reason, created_at, expires_at) VALUES (?,?,?,?,?,?,?)', [newId(), kind, subject, hits, String(reason).slice(0, 200), Date.now(), expires]);
  });
}
export const deleteBlock = (kind, subject) => db ? queue(() => db.run('DELETE FROM security_blocks WHERE kind = ? AND subject = ?', [kind, subject])) : Promise.resolve();
export const flushBlocks = () => chain;

// Called once at start, before listening. `sinks` get each unexpired row so the in-memory maps can be rebuilt.
export async function loadBlocks(database, sinks) {
  db = database;
  await db.run('DELETE FROM security_blocks WHERE expires_at < ?', [Date.now()]);
  const rows = await db.all('SELECT kind, subject, hits, reason, expires_at FROM security_blocks WHERE expires_at >= ?', [Date.now()]);
  const counts = {};
  for (const r of rows) { sinks[r.kind]?.({ subject: r.subject, hits: Number(r.hits), reason: r.reason, expires: Number(r.expires_at) }); counts[r.kind] = (counts[r.kind] || 0) + 1; }
  L.info('blocks.loaded', `Restored ${counts.lockout || 0} lockout(s) and ${counts.ban || 0} ban(s) from the database`, { data: counts });
  setInterval(() => { if (db) db.run('DELETE FROM security_blocks WHERE expires_at < ?', [Date.now()]).catch(() => {}); }, 60000).unref();
}
