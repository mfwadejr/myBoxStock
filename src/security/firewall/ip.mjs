// SECURITY / firewall / ip — address parsing and CIDR matching.
import net from 'node:net';

export const normalizeIp = (ip = '') => String(ip).replace(/^::ffff:/, '');
const ipv4ToInt = (ip) => ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;

export function matchCidr(ip, cidr) {
  ip = normalizeIp(ip);
  if (!cidr.includes('/')) return ip === cidr;
  const [base, bitsStr] = cidr.split('/'), bits = Number(bitsStr);
  if (net.isIPv4(ip) && net.isIPv4(base)) {
    if (bits === 0) return true;
    const mask = (~0 << (32 - bits)) >>> 0;
    return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
  }
  return false; // IPv6 ranges: exact addresses only for now
}
export function validCidr(c) {
  const [base, bits] = String(c).split('/');
  if (!net.isIP(base)) return false;
  if (bits === undefined) return true;
  const n = Number(bits);
  return Number.isInteger(n) && n >= 0 && n <= (net.isIPv4(base) ? 32 : 128);
}
