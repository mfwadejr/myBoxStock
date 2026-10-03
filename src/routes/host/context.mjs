// ROUTES / host / context — shared helpers for host-console routes.
import { log } from '../../logging/logger.mjs';
import { normalizeIp } from '../../security/firewall/ip.mjs';

// hostLog(req, 'info', 'backup.created', 'message', { data }, 'host' | 'accounts', accountId)
export function hostLog(req, level, event, message, { data, area = 'host', accountId = null } = {}) {
  log(area, level, event, message, { actor: req.subject?.username, accountId, ip: normalizeIp(req.ip), data });
}
