// SECURITY / firewall / middleware — the Express gate every request passes through first.
import { MSG } from '../../core/messages.mjs';
import { normalizeIp, matchCidr } from './ip.mjs';
import { config as appConfig } from '../../core/config.mjs';
import { getLimits, getRules, ruleAppliesToAppPort } from './config.mjs';
import { overLimit, recordViolation, banUntil, countBlocked, countLimited, logThrottled } from './ratelimit.mjs';

const isAuthPath = (p) => /\/(login|login\/mfa|forgot|reset|signup)$/.test(p);
// Page files (scripts, styles, images) are not counted by the request-flood counter: one page load asks for about 70 of them, so a few reloads from an office would trip the limit.
const isStaticPath = (p) => /^\/(css|js|assets)\//.test(p);
const isHostPath = (p) => p.startsWith('/api/host') || p.startsWith('/host');

export function firewallMiddleware(req, res, next) {
  const ip = normalizeIp(req.ip || req.socket.remoteAddress || ''), lim = getLimits(), rules = getRules();
  const deny = rules.some(r => r.kind === 'deny' && ruleAppliesToAppPort(r) && matchCidr(ip, r.cidr));
  const allowed = rules.some(r => r.kind === 'allow' && ruleAppliesToAppPort(r) && matchCidr(ip, r.cidr));
  if (deny && !allowed) { countBlocked(); logThrottled(`deny:${ip}`, 'warn', 'request.blocked', `Blocked ${ip} by address rule (${req.method} ${req.path})`, { ip, data: { path: req.path } }); return res.status(403).type('text/plain').send('Forbidden'); }
  if (lim.hostConsoleAllowOnly && !appConfig.hostAllowAny && isHostPath(req.path) && !rules.some(r => r.kind === 'host' && ruleAppliesToAppPort(r) && matchCidr(ip, r.cidr))) { countBlocked(); logThrottled(`hostonly:${ip}`, 'warn', 'host_console.blocked', `Host console request from address ${ip} outside the access list refused (${req.path})`, { ip, data: { path: req.path } }); return res.status(404).type('text/plain').send('Not Found'); }
  if (!lim.enabled || allowed) return next();

  const until = banUntil(ip);
  if (until) { countBlocked(); logThrottled(`ban:${ip}`, 'warn', 'request.banned', `Refused ${ip} — temporarily banned (${req.method} ${req.path})`, { ip }); res.set('Retry-After', String(Math.ceil((until - Date.now()) / 1000))); return res.status(429).json({ error: 'Too many requests. Try again later.' }); }
  if (!isStaticPath(req.path) && overLimit(`g:${ip}`, lim.windowSec * 1000, lim.maxRequests)) {
    countLimited(); recordViolation(ip, 'request flood'); logThrottled(`rl:${ip}`, 'warn', 'rate_limit.requests', `Rate limit hit by ${ip}: more than ${lim.maxRequests} requests in ${lim.windowSec}s`, { ip, data: { limit: lim.maxRequests, windowSec: lim.windowSec } });
    res.set('Retry-After', String(lim.windowSec)); return res.status(429).json({ error: MSG.RATE_LIMITED, code: 'RATE_LIMITED' });
  }
  if (req.method === 'POST' && isAuthPath(req.path) && overLimit(`a:${ip}`, lim.authWindowSec * 1000, lim.authMaxAttempts)) {
    countLimited(); recordViolation(ip, 'too many sign-in attempts'); logThrottled(`arl:${ip}`, 'warn', 'rate_limit.auth', `Too many sign-in attempts from ${ip}: more than ${lim.authMaxAttempts} in ${lim.authWindowSec}s (${req.path})`, { ip, data: { limit: lim.authMaxAttempts, windowSec: lim.authWindowSec, path: req.path } });
    res.set('Retry-After', String(lim.authWindowSec)); return res.status(429).json({ error: MSG.AUTH_RATE_LIMITED, code: 'AUTH_RATE_LIMITED' });
  }
  next();
}
