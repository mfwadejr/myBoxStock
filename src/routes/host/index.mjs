// ROUTES / host — assembles the Host Console API under /api/host.
import express from 'express';
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

export function hostRouter(db) {
  const r = express.Router();
  r.use(hostAuthRouter(db));                                  // /login, /login/mfa, /logout, /me, /change-password, /totp/*
  r.use(requireSession(db, 'host', loadAdmin));               // everything below needs a signed-in host admin
  r.use('/dashboard', dashboardRoutes(db)); r.use('/accounts', accountsRoutes(db)); r.use('/business', businessRoutes(db)); r.use('/backups', backupsRoutes(db));
  r.use('/mail', mailRoutes(db)); r.use('/firewall', firewallRoutes(db)); r.use('/settings', settingsRoutes(db));
  r.use('/admins', adminsRoutes(db)); r.use('/logs', logsRoutes(db)); r.use('/links', linksRoutes(db));
  return r;
}
