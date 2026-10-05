// SERVICES / backup / destinations / http — one small streaming HTTP(S) request helper for the S3 and WebDAV clients.
// A file body is streamed from disk (never held in memory); a download can be streamed to a file.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

export function request({ method = 'GET', url, headers = {}, file = null, body = null, toFile = null, timeoutMs = 600000 }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), mod = u.protocol === 'https:' ? https : http, h = { ...headers };
    if (file) h['content-length'] = String(fs.statSync(file).size); else if (body != null) h['content-length'] = String(Buffer.byteLength(body)); else if (method !== 'GET' && method !== 'HEAD') h['content-length'] = '0';
    const req = mod.request(u, { method, headers: h, timeout: timeoutMs }, (res) => {
      if (toFile && res.statusCode >= 200 && res.statusCode < 300) {
        const out = fs.createWriteStream(toFile, { mode: 0o600 });
        res.pipe(out); out.on('finish', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.alloc(0) })); out.on('error', reject); res.on('error', reject);
        return;
      }
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })); res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('The server did not answer in time.'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (file) fs.createReadStream(file).on('error', reject).pipe(req); else req.end(body);
  });
}
// Plain-English reason for a failed network call.
export function netProblem(e, where = 'the server') {
  const c = e?.code || e?.cause?.code;
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return `Could not find ${where}. Check the address for typing mistakes.`;
  if (c === 'ECONNREFUSED') return `${where[0].toUpperCase()}${where.slice(1)} refused the connection. Check the address and port.`;
  if (c === 'ETIMEDOUT' || c === 'ECONNRESET' || c === 'EHOSTUNREACH') return `Could not reach ${where} (it did not answer). Check the address and that this server can connect to it.`;
  if (/certificate|self.signed|SSL|TLS/i.test(String(e?.message))) return `${where[0].toUpperCase()}${where.slice(1)} has a certificate this server does not trust.`;
  return null;
}
