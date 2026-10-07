// ROUTES / app — assembles the account API under /api/app.
import express from 'express';
import { requireSession } from '../../auth/session.mjs';
import { appAuthRouter } from './auth.mjs';
import { publicRoutes } from './public.mjs';
import { usersRoutes } from './users.mjs';
import { rolesRoutes } from './roles.mjs';
import { vaultRoutes } from './vault.mjs';
import { activityRoutes } from './activity.mjs';
import { emailRoutes } from './email.mjs';
import { receiptRoutes } from './receipts.mjs';
import { accountRoutes } from './account.mjs';
import { backupRoutes, diagnosticsRoutes } from './backup.mjs';
import { termsRoutes, termsGate } from './terms.mjs';
import { hostLinkRoutes } from './hostlink.mjs';
import { docsRoutes } from '../docs.mjs';
import { loadUser } from './context.mjs';
import { log } from '../../logging/logger.mjs';
import { fullPath } from '../../core/http.mjs';
import { fail } from '../../core/messages.mjs';
import { activeAnnouncement } from '../../services/announcement/index.mjs';

export function appRouter(db) {
  const r = express.Router();
  r.use(appAuthRouter(db)); r.use(publicRoutes(db));
  r.use(requireSession(db, 'app', loadUser));
  r.use((req, res, next) => { db.run('UPDATE accounts SET last_activity = ? WHERE id = ?', [Date.now(), req.subject.account_id]).catch(() => {}); next(); });
  // Remember when this session was last used (at most once a minute) so people can see which devices are active.
  r.use((req, res, next) => { if (Date.now() - Number(req.session.last_seen || 0) > 60e3) db.run('UPDATE sessions SET last_seen = ? WHERE token_hash = ?', [Date.now(), req.session.token_hash]).catch(() => {}); next(); });
  r.use('/terms', termsRoutes(db)); r.use(termsGate);   // updated terms: an Administrator accepts first (before the closing and read-only checks, which must not stop this)
  // A closing account is read-only for its Administrators (so they can still export) until it is restored or erased.
  r.use((req, res, next) => {
    if (!req.subject.closing_at || req.method === 'GET' || req.method === 'HEAD' || ['/account/restore', '/account/export-note', '/backup/made'].includes(req.path)) return next();
    log('tenant', 'warn', 'account.closing_locked', `${req.subject.login} tried ${req.method} ${fullPath(req)} but the account is closing`, { actor: req.subject.login, accountId: req.subject.account_id });
    fail(res, 423, 'ACCOUNT_CLOSING_LOCKED');
  });
  r.use('/docs', docsRoutes('reseller'));
  r.get('/announcement', async (req, res) => res.json({ announcement: await activeAnnouncement(db) }));
  r.use('/account', accountRoutes(db)); // closing is allowed even when a trial has ended
  // Ended trials and paid periods are read-only: viewing still works, changes are refused (data is never deleted).
  r.use((req, res, next) => {
    if (req.subject.billing.canWrite || req.method === 'GET' || req.method === 'HEAD' || req.path === '/backup/made') return next();   // a read-only account can still make a backup
    log('tenant', 'warn', 'billing.read_only', `${req.subject.login} tried ${req.method} ${fullPath(req)} but the account is read-only (${req.subject.billing.state})`, { actor: req.subject.login, accountId: req.subject.account_id, data: { state: req.subject.billing.state } });
    fail(res, 402, 'ACCOUNT_READ_ONLY', { billing: req.subject.billing });
  });
  r.use('/receipt-email', receiptRoutes(db)); r.use('/users', usersRoutes(db)); r.use('/roles', rolesRoutes(db)); r.use('/vault', vaultRoutes(db)); r.use('/backup', backupRoutes(db)); r.use('/diagnostics', diagnosticsRoutes(db)); r.use('/activity', activityRoutes(db)); r.use('/hostlink', hostLinkRoutes(db)); r.use('/email', emailRoutes(db));
  return r;
}
