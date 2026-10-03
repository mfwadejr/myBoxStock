// CLI / host-admin — create the first host administrator, or reset it (also used by `reset-host-admin`).
import { hashPassword } from '../auth/password.mjs';
import { newId, token } from '../core/ids.mjs';
import { areaLogger } from '../logging/logger.mjs';

const L = areaLogger('host');

export async function ensureHostAdmin(db, { reset = false } = {}) {
  const existing = await db.get('SELECT id, username FROM host_admins ORDER BY created_at LIMIT 1');
  if (existing && !reset) return null;
  const pw = token(9).replace(/[-_]/g, 'k') + '7';
  if (existing) {
    await db.run('UPDATE host_admins SET pw_hash = ?, must_change = 1, totp_enabled = 0, totp_secret = NULL, recovery_hashes = NULL WHERE id = ?', [hashPassword(pw), existing.id]);
    await db.run("DELETE FROM sessions WHERE realm = 'host'");
    L.warn('admin.reset_cli', `Host admin "${existing.username}" reset from the command line (password replaced, two-factor cleared, sessions ended)`, { actor: 'cli' });
  } else {
    await db.run('INSERT INTO host_admins (id, username, pw_hash, must_change, created_at) VALUES (?,?,?,1,?)', [newId(), 'admin', hashPassword(pw), Date.now()]);
    L.info('admin.bootstrap', 'First-run host administrator "admin" created with a temporary password', { actor: 'system' });
  }
  return pw;
}
