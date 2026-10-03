// ROUTES / app / auth — wires the shared sign-in router to the account_users table.
import { authRouter } from '../../auth/router/index.mjs';
import { loadUser, publicUser } from './context.mjs';
import { vaultState, validKeys, saveKeys } from '../../services/vault/keys.mjs';
import { MSG } from '../../core/messages.mjs';
import { recordSignIn } from '../../services/signins/index.mjs';

export const appAuthRouter = (db) => authRouter({
  db, realm: 'app', table: 'account_users', loadSubject: loadUser, publicUser,
  meExtra: (d, user) => vaultState(d, user),
  // A password change in an encrypted account must come with the account key re-wrapped under the new password, or the person would lose access to data.
  passwordKeys: async (d, user, keys) => {
    const st = await vaultState(d, user); if (!st.enabled || !st.keys) return null;
    if (!validKeys(keys)) return { error: MSG.VAULT_BAD_KEYS, code: 'VAULT_BAD_KEYS' };
    await saveKeys(d, user, keys); return null;
  },
  record: (info) => recordSignIn(db, info),
  findByLogin: async (d, login) => {
    const u = await d.get('SELECT u.*, a.status AS account_status FROM account_users u JOIN accounts a ON a.id = u.account_id WHERE u.login = ?', [login]);
    if (u && u.account_status !== 'active') u.blockedReason = 'ACCOUNT_SUSPENDED';
    return u;
  },
  who: (u) => ({ actor: u?.login || null, accountId: u?.account_id || null }),
});
