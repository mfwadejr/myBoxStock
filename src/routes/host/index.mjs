// ROUTES / host — assembles the Host Console API under /api/host.
import express from 'express';
import { fail } from '../../core/messages.mjs';
import { requireSession } from '../../auth/session.mjs';
import { hostAuthRouter, loadAdmin } from './auth.mjs';
import { dashboardRoutes } from './dashboard.mjs';
import { businessRoutes } from './business.mjs';
import { accountsRoutes } from './accounts.mjs';
import { backupsRoutes } from './backups.mjs';
import { mailRoutes } from './mail.mjs';
import { firewallRoutes } from './firewall.mjs';
import { settingsRoutes } from './settings.mjs';
import { adminsRoutes } from './admins.mjs';
import { logsRoutes } from './logs.mjs';
import { linksRoutes } from './links.mjs';
import { alertsRoutes, updatesRoutes } from './alerts.mjs';
import { docsRoutes } from '../docs.mjs';
import { auditRoutes } from './audit.mjs';
import { onboardingRoutes } from './onboarding.mjs';
import { supportRoutes } from './support.mjs';
import { retentionRoutes } from './retention.mjs';

export function hostRouter(db) {
  const r = express.Router();
  r.use(hostAuthRouter(db));                                  // /login, /login/mfa, /logout, /me, /change-password, /totp/*
  r.use(requireSession(db, 'host', loadAdmin));               // everything below needs a signed-in host admin
  // Every helper administrator must have two-factor on before using the console. The Owner (oldest administrator) is exempt so nobody can be locked out of their own server.
  r.use(async (req, res, next) => {
    try {
      if (req.subject.totp_enabled) return next();
      const owner = await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1');
      if (owner?.id === req.subject.id) return next();
      return fail(res, 403, 'MFA_SETUP_REQUIRED');
    } catch (e) { next(e); }
  });
  r.use('/dashboard', dashboardRoutes(db)); r.use('/accounts', accountsRoutes(db)); r.use('/business', businessRoutes(db)); r.use('/backups', backupsRoutes(db));
  r.use('/mail', mailRoutes(db)); r.use('/firewall', firewallRoutes(db)); r.use('/settings', settingsRoutes(db));
  r.use('/admins', adminsRoutes(db)); r.use('/logs', logsRoutes(db)); r.use('/links', linksRoutes(db));
  r.use('/alerts', alertsRoutes(db)); r.use('/updates', updatesRoutes(db)); r.use('/audit', auditRoutes(db)); r.use('/docs', docsRoutes('host')); r.use('/onboarding', onboardingRoutes(db)); r.use('/support', supportRoutes(db)); r.use('/retention', retentionRoutes(db));
  return r;
}
