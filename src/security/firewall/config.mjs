// SECURITY / firewall / config — rate-limit settings and address rules (cached in memory, stored in the database).
import { getSetting, setSetting } from '../../db/settings.mjs';
import { newId } from '../../core/ids.mjs';
import { config as appConfig } from '../../core/config.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { validCidr } from './ip.mjs';

const L = areaLogger('security');

export const DEFAULT_LIMITS = {
  enabled: true,
  windowSec: 60, maxRequests: 300,          // all requests, per IP
  authWindowSec: 300, authMaxAttempts: 10,  // sign-in / reset endpoints, per IP
  banMinutes: 15, banAfterViolations: 5,    // temporary ban after repeated violations
  hostConsoleAllowOnly: false,              // host console answers only allow-listed addresses
};
let limits = { ...DEFAULT_LIMITS };
let rules = [];

export const getLimits = () => limits;
export const getRules = () => rules;

export async function loadFirewall(db) {
  limits = { ...DEFAULT_LIMITS, ...(await getSetting(db, 'firewall_limits', {})) };
  rules = await db.all('SELECT * FROM firewall_rules WHERE enabled = 1');
  L.info('loaded', `Firewall loaded: ${rules.length} active rule(s), rate limiting ${limits.enabled ? 'on' : 'off'}`, { data: { rules: rules.length, limits } });
}
export async function saveLimits(db, patch, actor) {
  const n = (v, min, max, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d; };
  const before = limits;
  limits = {
    enabled: !!patch.enabled, windowSec: n(patch.windowSec, 1, 3600, before.windowSec), maxRequests: n(patch.maxRequests, 10, 100000, before.maxRequests),
    authWindowSec: n(patch.authWindowSec, 10, 86400, before.authWindowSec), authMaxAttempts: n(patch.authMaxAttempts, 1, 1000, before.authMaxAttempts),
    banMinutes: n(patch.banMinutes, 1, 10080, before.banMinutes), banAfterViolations: n(patch.banAfterViolations, 1, 100, before.banAfterViolations),
    hostConsoleAllowOnly: patch.hostConsoleAllowOnly === undefined ? before.hostConsoleAllowOnly : !!patch.hostConsoleAllowOnly,
  };
  await setSetting(db, 'firewall_limits', limits);
  L.info('limits.changed', 'Rate-limit settings changed', { actor, data: { before, after: limits } });
  return limits;
}
export async function addRule(db, { kind, cidr, port = null, note = '' }, actor) {
  if (!['deny', 'allow', 'host'].includes(kind)) throw new Error('kind must be deny, allow or host');
  if (!validCidr(cidr)) throw new Error('Enter a valid IP address or CIDR range, e.g. 203.0.113.0/24');
  const id = newId();
  await db.run('INSERT INTO firewall_rules (id, kind, cidr, port, note, enabled, created_at) VALUES (?,?,?,?,?,1,?)', [id, kind, cidr, port ? Number(port) : null, String(note).slice(0, 200), Date.now()]);
  await loadFirewall(db);
  L.info('rule.added', `Added ${kind} rule for ${cidr}${note ? ` (${note})` : ''}`, { actor, data: { id, kind, cidr, port, note } });
  return id;
}
export async function removeRule(db, id, actor) {
  const r = await db.get('SELECT kind, cidr FROM firewall_rules WHERE id = ?', [id]);
  await db.run('DELETE FROM firewall_rules WHERE id = ?', [id]); await loadFirewall(db);
  L.info('rule.removed', `Removed ${r?.kind || ''} rule for ${r?.cidr || id}`, { actor, data: { id, ...r } });
}
export async function setRuleEnabled(db, id, on, actor) {
  await db.run('UPDATE firewall_rules SET enabled = ? WHERE id = ?', [on ? 1 : 0, id]); await loadFirewall(db);
  L.info('rule.toggled', `Rule ${id} ${on ? 'enabled' : 'disabled'}`, { actor, data: { id, enabled: on } });
}
export const ruleAppliesToAppPort = (r) => !r.port || r.port === appConfig.port;
export async function setHostAccess(db, on, actor) {
  limits = { ...limits, hostConsoleAllowOnly: !!on }; await setSetting(db, 'firewall_limits', limits);
  L.info('host_access.changed', `Host Console access limit turned ${on ? 'on' : 'off'}`, { actor, data: { enabled: !!on } });
  return limits;
}
