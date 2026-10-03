// SERVICES / vault / keys — checking and storing the wrapped keys the browser sends. The server cannot open any of them.
const WRAPPED = /^v1\.[A-Za-z0-9+/=]{8,64}\.[A-Za-z0-9+/=]{20,400}$/;
export const MIN_ITERS = 100000, MAX_ITERS = 5000000;

export function validWrapped(w) { return typeof w === 'string' && WRAPPED.test(w); }
export function validKeys(k) {
  return !!k && typeof k.salt === 'string' && /^[A-Za-z0-9+/=]{16,64}$/.test(k.salt) && Number.isInteger(k.iters) && k.iters >= MIN_ITERS && k.iters <= MAX_ITERS && validWrapped(k.wrappedAdk);
}
export async function saveKeys(db, user, k) {
  const now = Date.now();
  const n = await db.run('UPDATE account_keys SET salt = ?, iters = ?, wrapped_adk = ?, updated_at = ? WHERE user_id = ? AND account_id = ?', [k.salt, k.iters, k.wrappedAdk, now, user.id, user.account_id]);
  if (!n.changes) await db.run('INSERT INTO account_keys (user_id, account_id, salt, iters, wrapped_adk, updated_at) VALUES (?,?,?,?,?,?)', [user.id, user.account_id, k.salt, k.iters, k.wrappedAdk, now]);
}
export const dropKeys = (db, userId) => db.run('DELETE FROM account_keys WHERE user_id = ?', [userId]);
export const vaultEnabled = async (db, accountId) => !!await db.get('SELECT account_id FROM account_recovery WHERE account_id = ?', [accountId]);
export async function vaultState(db, user) {
  const enabled = await vaultEnabled(db, user.account_id);
  const k = enabled && await db.get('SELECT salt, iters, wrapped_adk FROM account_keys WHERE user_id = ?', [user.id]);
  const out = { enabled, keys: k ? { salt: k.salt, iters: Number(k.iters), wrappedAdk: k.wrapped_adk } : null };
  if (enabled) { const r = await db.get('SELECT confirmed_at FROM account_recovery WHERE account_id = ?', [user.account_id]); out.recoveryConfirmed = !!r?.confirmed_at; }
  else if (user.role === 'Administrator') out.legacyItems = Number((await db.get('SELECT COUNT(*) AS n FROM inventory_items WHERE account_id = ?', [user.account_id])).n);
  return out;
}
