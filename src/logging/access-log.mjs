// LOGGING / access-log — Express middleware: one log line for every request (area: http).
import { areaLogger } from './logger.mjs';
import { normalizeIp } from '../security/firewall/ip.mjs';
import { fullPath } from '../core/http.mjs';

const L = areaLogger('http');

export function accessLog(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode, ip = normalizeIp(req.ip || '');
    const who = req.subject?.login || req.subject?.username || null;
    const level = status >= 500 ? 'error' : status === 429 || status === 403 ? 'warn' : 'info';
    L[level]('request', `${req.method} ${fullPath(req)} → ${status} (${ms.toFixed(1)} ms)`, {
      actor: who, accountId: req.subject?.account_id || null, ip,
      data: { method: req.method, path: fullPath(req), status, ms: Math.round(ms * 10) / 10, bytes: Number(res.getHeader('content-length')) || null, ua: String(req.headers['user-agent'] || '').slice(0, 160) },
    });
  });
  next();
}
