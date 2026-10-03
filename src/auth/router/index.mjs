// AUTH / router — shared sign-in endpoints used by both realms (host console and account app).
import express from 'express';
import { log } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';
import { loginRoutes } from './login.mjs';
import { mfaRoutes } from './mfa.mjs';
import { passwordRoutes } from './password.mjs';
import { totpRoutes } from './totp-routes.mjs';

// options: { db, realm, table, findByLogin(db, login), loadSubject(db, session), publicUser(user), who(user) -> {actor, accountId} }
export function authRouter(options) {
  const c = { ...options };
  // c.log.<level>(event, message, req, user, data) — logs to the auth area with actor/account/ip filled in.
  c.log = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(lvl => [lvl, (event, message, req, user, data) =>
    log('auth', lvl, event, message, { ...c.who(user), ip: normalizeIp(req.ip), data })]));
  const r = express.Router();
  loginRoutes(r, c); mfaRoutes(r, c); passwordRoutes(r, c); totpRoutes(r, c);
  return r;
}
