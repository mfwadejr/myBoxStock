// ROUTES / app / terms — an Administrator accepts the current Terms of Service and Privacy Policy (asked once per new version, at the next sign-in).
import express from 'express';
import { tenantLog } from './context.mjs';
import { fail } from '../../core/messages.mjs';
import { TERMS_VERSION, recordAcceptance } from '../../services/legal/index.mjs';
import { log } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';

export function termsRoutes(db) {
  const r = express.Router();
  r.post('/accept', async (req, res) => {
    const u = req.subject; if (u.role !== 'Administrator') return fail(res, 403, 'PERMISSION_DENIED');
    if (req.body.version !== TERMS_VERSION) return fail(res, 409, 'TERMS_STALE');
    await recordAcceptance(db, u.account_id);
    tenantLog(req, 'terms.accepted', `${u.login} accepted the Terms of Service and Privacy Policy, version ${TERMS_VERSION}`, { version: TERMS_VERSION });
    log('accounts', 'info', 'terms.accepted', `Terms of Service and Privacy Policy version ${TERMS_VERSION} accepted by ${u.login}`, { actor: u.login, accountId: u.account_id, ip: normalizeIp(req.ip), data: { version: TERMS_VERSION, via: 'signin' } });
    res.json({ ok: true, version: TERMS_VERSION });
  });
  return r;
}

// Until an Administrator accepts updated terms, everything else on the account is refused (reading the documentation is still allowed).
export function termsGate(req, res, next) {
  if (!req.subject.termsRequired || req.path.startsWith('/docs')) return next();
  fail(res, 403, 'TERMS_ACCEPT_REQUIRED', { termsRequired: true });
}
