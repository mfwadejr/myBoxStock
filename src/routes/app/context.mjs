// ROUTES / app / context — loading the signed-in account user, permissions, and tenant-area logging.
import { isHeld, mailReady } from '../../services/verify/index.mjs';
import { log } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';
import { fullPath } from '../../core/http.mjs';
import { fail } from '../../core/messages.mjs';
import { billingState } from '../../services/billing/state.mjs';
import { termsOf } from '../../services/legal/index.mjs';
import { isOn as demoOn } from '../../services/demo/settings.mjs';

export const DEFAULT_ROLES = {
  Administrator: ['*'],
  Standard: ['inventory.read', 'inventory.write', 'sales.read', 'sales.write', 'customers.read', 'customers.write'],
  View: ['inventory.read', 'sales.read', 'customers.read'],
};
export const can = (perms, p) => perms.includes('*') || perms.includes(p);

export async function loadUser(db, s) {
  const u = await db.get(`SELECT u.*, a.status AS account_status, a.account_code, a.business_name, a.plan, a.trial_ends_at, a.plan_until, a.host_link_allowed, a.closing_at, a.terms_version, a.demo FROM account_users u JOIN accounts a ON a.id = u.account_id WHERE u.id = ?`, [s.subject_id]);
  if (!u || u.disabled || u.account_status !== 'active') return null;
  if (u.demo && !await demoOn(db)) return null;   // a demo login only works while Demo mode is on
  const role = await db.get('SELECT perms FROM account_roles WHERE account_id = ? AND name = ?', [u.account_id, u.role]);
  u.perms = role ? JSON.parse(role.perms) : [];
  u.billing = billingState(u);
  u.email_held = await isHeld(db, u); u.verify_available = await mailReady(db);
  u.termsRequired = u.role === 'Administrator' && termsOf(u).outdated;   // only Administrators are asked; the answer binds the whole account
  u.host_linked = !!u.host_link_allowed && !!await db.get('SELECT id FROM admin_links WHERE user_id = ?', [u.id]);
  return u;
}
export const publicUser = (u) => ({ id: u.id, username: u.username, login: u.login, label: u.login, email: u.email, role: u.role, perms: u.perms,
  accountCode: u.account_code, businessName: u.business_name, totpEnabled: !!u.totp_enabled, hostLinked: !!u.host_linked, hostLinkAllowed: !!u.host_link_allowed,
  demo: !!u.demo, closingAt: u.closing_at ? Number(u.closing_at) : null, emailVerified: !!u.email_verified_at, emailBanner: !!u.email && !u.email_verified_at && !!u.verify_available, emailHeld: !!u.email_held, termsRequired: !!u.termsRequired, termsVersion: termsOf(u).current,
  billing: { state: u.billing.state, endsAt: u.billing.endsAt, daysLeft: u.billing.daysLeft, canWrite: u.billing.canWrite } });

// tenantLog(req, event, message, data) — activity in the `tenant` area. Pass ids and event names only, never business data.
export function tenantLog(req, event, message, data) {
  log('tenant', 'info', event, message, { actor: req.subject?.login, accountId: req.subject?.account_id, ip: normalizeIp(req.ip), data });
}
export const need = (perm) => (req, res, next) => can(req.subject.perms, perm) ? next()
  : (log('tenant', 'warn', 'permission.denied', `${req.subject.login} (${req.subject.role}) was denied "${perm}" on ${req.method} ${fullPath(req)}`, { actor: req.subject.login, accountId: req.subject.account_id, ip: normalizeIp(req.ip), data: { perm } }),
     fail(res, 403, 'PERMISSION_DENIED'));
