// SECURITY / firewall / ports — which TCP ports this container is listening on (Linux: /proc/net/tcp{,6}, state 0A).
import fs from 'node:fs';
import { config } from '../../core/config.mjs';

const KNOWN = { 22: 'SSH', 25: 'SMTP', 80: 'HTTP', 443: 'HTTPS', 3306: 'MariaDB / MySQL', 5432: 'PostgreSQL', 6379: 'Redis' };

export function listeningPorts() {
  const out = new Map();
  for (const f of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of txt.split('\n').slice(1)) {
      const p = line.trim().split(/\s+/); if (p.length < 4 || p[3] !== '0A') continue;
      const [addrHex, portHex] = p[1].split(':'), port = parseInt(portHex, 16);
      const loopback = /^0*1$/.test(addrHex) || addrHex === '0100007F', wildcard = /^0+$/.test(addrHex);
      const cur = out.get(port) || { port, scope: loopback ? 'loopback' : wildcard ? 'all interfaces' : 'specific' };
      if (!loopback && wildcard) cur.scope = 'all interfaces';
      out.set(port, cur);
    }
  }
  return [...out.values()].sort((a, b) => a.port - b.port).map(p => ({
    ...p, label: p.port === config.port ? 'myBoxStock web (this app)' : KNOWN[p.port] || 'Unknown service', enforced: p.port === config.port }));
}
