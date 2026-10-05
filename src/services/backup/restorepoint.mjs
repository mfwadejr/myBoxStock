// SERVICES / backup / restorepoint — the 7-day safety copy taken before a reseller restores a backup file. Ciphertext only: the host cannot read it.
export const KEEP_MS = 7 * 24 * 3600e3;

// Removes expired safety copies (called whenever one is looked at or made).
export async function purgeExpired(db, now = Date.now()) {
  const old = await db.all('SELECT account_id FROM restore_points WHERE expires_at <= ?', [now]);
  for (const o of old) await db.tx(async (t) => { await t.run('DELETE FROM restore_point_records WHERE account_id = ?', [o.account_id]); await t.run('DELETE FROM restore_points WHERE account_id = ?', [o.account_id]); });
  return old.length;
}
export async function currentPoint(db, accountId, now = Date.now()) {
  await purgeExpired(db, now);
  const p = await db.get('SELECT created_at, expires_at, record_count, mode FROM restore_points WHERE account_id = ?', [accountId]);
  return p ? { createdAt: Number(p.created_at), expiresAt: Number(p.expires_at), count: Number(p.record_count), mode: p.mode } : null;
}
// One per account: a new one replaces the old. Copied inside the database so nothing passes through the server's memory.
export async function makePoint(db, accountId, by, mode, now = Date.now()) {
  let count = 0;
  await db.tx(async (t) => {
    await t.run('DELETE FROM restore_point_records WHERE account_id = ?', [accountId]); await t.run('DELETE FROM restore_points WHERE account_id = ?', [accountId]);
    await t.run('INSERT INTO restore_point_records (account_id, id, type, blob, rev, created_at, updated_at) SELECT account_id, id, type, blob, rev, created_at, updated_at FROM records WHERE account_id = ?', [accountId]);
    count = Number((await t.get('SELECT COUNT(*) AS n FROM restore_point_records WHERE account_id = ?', [accountId])).n);
    await t.run('INSERT INTO restore_points (account_id, created_at, expires_at, created_by, record_count, mode) VALUES (?,?,?,?,?,?)', [accountId, now, now + KEEP_MS, by, count, mode]);
  });
  return { createdAt: now, expiresAt: now + KEEP_MS, count, mode };
}
// Puts the account's records back exactly as the safety copy had them, in one transaction. Revisions move forward so open browsers re-read everything.
export async function undoPoint(db, accountId, now = Date.now()) {
  const p = await currentPoint(db, accountId, now); if (!p) return null;
  await db.tx(async (t) => {
    const cur = new Map((await t.all('SELECT id, rev FROM records WHERE account_id = ?', [accountId])).map(r => [r.id, Number(r.rev)]));
    const snap = await t.all('SELECT id, type, blob, rev, created_at FROM restore_point_records WHERE account_id = ?', [accountId]);
    await t.run('DELETE FROM records WHERE account_id = ?', [accountId]);
    for (const r of snap) await t.run('INSERT INTO records (id, account_id, type, blob, rev, created_at, updated_at) VALUES (?,?,?,?,?,?,?)', [r.id, accountId, r.type, r.blob, Math.max(Number(r.rev), cur.get(r.id) || 0) + 1, r.created_at, now]);
    await t.run('DELETE FROM restore_point_records WHERE account_id = ?', [accountId]); await t.run('DELETE FROM restore_points WHERE account_id = ?', [accountId]);
  });
  return p;
}
