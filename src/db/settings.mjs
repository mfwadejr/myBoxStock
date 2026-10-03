// DATABASE / settings — key/value store (JSON encoded) for platform settings.
export async function getSetting(db, key, fallback = null) {
  const r = await db.get('SELECT v FROM settings WHERE k = ?', [key]);
  if (!r || r.v == null) return fallback;
  try { return JSON.parse(r.v); } catch { return fallback; }
}
export async function setSetting(db, key, value) {
  await db.tx(async (t) => {
    await t.run('DELETE FROM settings WHERE k = ?', [key]);
    await t.run('INSERT INTO settings (k, v, updated_at) VALUES (?, ?, ?)', [key, JSON.stringify(value), Date.now()]);
  });
}
