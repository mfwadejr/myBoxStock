// ROUTES / host / auth — wires the shared sign-in router to the host_admins table.
import { authRouter } from '../../auth/router/index.mjs';

export const loadAdmin = (db, s) => db.get('SELECT * FROM host_admins WHERE id = ?', [s.subject_id]);

export const hostAuthRouter = (db) => authRouter({
  db, realm: 'host', table: 'host_admins', loadSubject: loadAdmin,
  findByLogin: (d, login) => d.get('SELECT * FROM host_admins WHERE username = ?', [login]),
  publicUser: (u) => ({ id: u.id, username: u.username, label: u.username, email: u.email, totpEnabled: !!u.totp_enabled }),
  who: (u) => ({ actor: u?.username || null, accountId: null }),
});
