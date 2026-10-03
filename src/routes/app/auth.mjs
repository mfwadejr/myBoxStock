// ROUTES / app / auth — wires the shared sign-in router to the account_users table.
import { authRouter } from '../../auth/router/index.mjs';
import { loadUser, publicUser } from './context.mjs';

export const appAuthRouter = (db) => authRouter({
  db, realm: 'app', table: 'account_users', loadSubject: loadUser, publicUser,
  findByLogin: async (d, login) => {
    const u = await d.get('SELECT u.*, a.status AS account_status FROM account_users u JOIN accounts a ON a.id = u.account_id WHERE u.login = ?', [login]);
    if (u && u.account_status !== 'active') u.disabled = 1;
    return u;
  },
  who: (u) => ({ actor: u?.login || null, accountId: u?.account_id || null }),
});
