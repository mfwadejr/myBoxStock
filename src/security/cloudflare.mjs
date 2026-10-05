// SECURITY / cloudflare — when the site sits behind Cloudflare, the visitor's real address is in the CF-Connecting-IP header.
// It is believed only when the request really arrived through a Cloudflare address, so nobody else can fake it.
import net from 'node:net';
import { matchCidr, normalizeIp } from './firewall/ip.mjs';

// Cloudflare's published ranges (https://www.cloudflare.com/ips/). Kept here, in one place.
export const CLOUDFLARE_V4 = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'];
export const CLOUDFLARE_V6 = ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'];

function v6ToBig(ip) {
  let s = ip.split('%')[0]; if (s.includes('::')) { const [a, b] = s.split('::'), A = a ? a.split(':') : [], B = b ? b.split(':') : []; s = [...A, ...Array(8 - A.length - B.length).fill('0'), ...B].join(':'); }
  return s.split(':').reduce((n, h) => (n << 16n) + BigInt(parseInt(h || '0', 16)), 0n);
}
function inV6(ip, cidr) {
  const [base, bitsStr] = cidr.split('/'), bits = BigInt(bitsStr), shift = 128n - bits;
  try { return (v6ToBig(ip) >> shift) === (v6ToBig(base) >> shift); } catch { return false; }
}
export function isCloudflare(ip) {
  ip = normalizeIp(ip || '');
  if (net.isIPv4(ip)) return CLOUDFLARE_V4.some(c => matchCidr(ip, c));
  if (net.isIPv6(ip)) return CLOUDFLARE_V6.some(c => inV6(ip, c));
  return false;
}
// seen = the address the proxy count gives us. Returns the visitor's address if it came through Cloudflare, else ''.
export function visitorViaCloudflare(headers, seen) {
  const h = String(headers['cf-connecting-ip'] || '').trim();
  return h && net.isIP(h) && isCloudflare(seen) ? normalizeIp(h) : '';
}
