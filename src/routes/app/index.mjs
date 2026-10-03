// ROUTES / app — assembles the account API under /api/app.
import express from 'express';
import { requireSession } from '../../auth/session.mjs';
import { appAuthRouter } from './auth.mjs';
import { publicRoutes } from './public.mjs';
import { usersRoutes } from './users.mjs';
import { rolesRoutes } from './roles.mjs';
import { inventoryRoutes } from './inventory.mjs';
import { loadUser } from './context.mjs';
import { log } from '../../logging/logger.mjs';
import { fullPath } from '../../core/http.mjs';

export function appRouter(db) {
  const r = express.Router();
  r.use(appAuthRouter(db)); r.use(publicRoutes(db));
  r.use(requireSession(db, 'app', loadUser));
  r.use((req, res, next) => { db.run('UPDATE accounts SET last_activity = ? WHERE id = ?', [Date.now(), req.subject.account_id]).catch(() => {}); next(); });
  // Ended trials and paid periods are read-only: viewing still works, changes are refused (data is never deleted).
  r.use((req, res, next) => {
    if (req.subject.billing.canWrite || req.method === 'GET' || req.method === 'HEAD') return next();
    log('tenant', 'warn', 'billing.read_only', `${req.subject.login} tried ${req.method} ${fullPath(req)} but the account is read-only (${req.subject.billing.state})`, { actor: req.subject.login, accountId: req.subject.account_id, data: { state: req.subject.billing.state } });
    res.status(402).json({ error: 'This account’s trial has ended, so it is read-only. Contact support to continue.', billing: req.subject.billing });
  });
  r.use('/users', usersRoutes(db)); r.use('/roles', rolesRoutes(db)); r.use('/inventory', inventoryRoutes(db));
  return r;
}
