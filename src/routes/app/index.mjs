// ROUTES / app — assembles the account API under /api/app.
import express from 'express';
import { requireSession } from '../../auth/session.mjs';
import { appAuthRouter } from './auth.mjs';
import { publicRoutes } from './public.mjs';
import { usersRoutes } from './users.mjs';
import { rolesRoutes } from './roles.mjs';
import { inventoryRoutes } from './inventory.mjs';
import { loadUser } from './context.mjs';

export function appRouter(db) {
  const r = express.Router();
  r.use(appAuthRouter(db)); r.use(publicRoutes(db));
  r.use(requireSession(db, 'app', loadUser));
  r.use((req, res, next) => { db.run('UPDATE accounts SET last_activity = ? WHERE id = ?', [Date.now(), req.subject.account_id]).catch(() => {}); next(); });
  r.use('/users', usersRoutes(db)); r.use('/roles', rolesRoutes(db)); r.use('/inventory', inventoryRoutes(db));
  return r;
}
