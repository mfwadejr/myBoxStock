// SERVICES / backup / destinations / s3 — S3-compatible storage (Backblaze B2, Wasabi, Cloudflare R2, Amazon S3, MinIO) with AWS Signature V4.
// Uploads are streamed from disk. Over https the body is sent as UNSIGNED-PAYLOAD (the connection protects it) with a Content-MD5 the server checks;
// over plain http the payload hash is signed, so nothing can be altered on the way.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { request, netProblem } from './http.mjs';

const hex = (b) => b.toString('hex'), sha256 = (d) => crypto.createHash('sha256').update(d).digest(), hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = (p) => p.split('/').map(enc).join('/');

export function hashFile(file) {
  return new Promise((res, rej) => { const a = crypto.createHash('sha256'), m = crypto.createHash('md5'); fs.createReadStream(file).on('data', (c) => { a.update(c); m.update(c); }).on('end', () => { const md5 = m.digest(); res({ sha256: a.digest('hex'), md5: md5.toString('hex'), md5b64: md5.toString('base64') }); }).on('error', rej); });
}
// Builds the headers that sign a request. `path` is already URI-encoded; `query` is an object of plain values.
export function signV4({ method, host, path, query = {}, payloadHash, accessKey, secretKey, region, service = 's3', now = new Date(), extra = {} }) {
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ''), day = amz.slice(0, 8);
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amz, ...extra };
  const names = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonHeaders = names.map(n => `${n}:${String(headers[Object.keys(headers).find(k => k.toLowerCase() === n)]).trim()}\n`).join('');
  const canonQuery = Object.entries(query).map(([k, v]) => [enc(k), enc(String(v))]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('&');
  const canonical = [method, path, canonQuery, canonHeaders, names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`, toSign = ['AWS4-HMAC-SHA256', amz, scope, hex(sha256(canonical))].join('\n');
  const kSigning = hmac(hmac(hmac(hmac('AWS4' + secretKey, day), region), service), 'aws4_request');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${hex(hmac(kSigning, toSign))}`;
  return { headers, canonicalRequest: canonical };
}

export function s3Client(s, secrets, { now = () => new Date() } = {}) {
  const region = s.region || 'us-east-1', endpoint = new URL((s.endpoint || `https://s3.${region}.amazonaws.com`).replace(/\/+$/, ''));
  const prefix = (s.prefix || '').split('/').filter(Boolean).join('/'), keyOf = (n) => (prefix ? prefix + '/' : '') + n;
  const secure = endpoint.protocol === 'https:';
  const target = (key, query) => {
    const host = s.pathStyle ? endpoint.host : `${s.bucket}.${endpoint.host}`;
    const path = (endpoint.pathname.replace(/\/+$/, '') || '') + (s.pathStyle ? '/' + enc(s.bucket) : '') + (key ? '/' + encPath(key) : '/');
    const qs = Object.entries(query || {}).map(([k, v]) => `${enc(k)}=${enc(String(v))}`).join('&');
    return { host, path, url: `${endpoint.protocol}//${host}${path}${qs ? '?' + qs : ''}` };
  };
  async function call(method, key, { query, file, hashes, body, toFile } = {}) {
    const t = target(key, query), payloadHash = file ? (secure ? 'UNSIGNED-PAYLOAD' : hashes.sha256) : hex(sha256(body || ''));
    const { headers } = signV4({ method, host: t.host, path: t.path, query: query || {}, payloadHash, accessKey: s.accessKey, secretKey: secrets.secretKey, region, now: now() });
    delete headers.host; if (hashes) headers['content-md5'] = hashes.md5b64;
    let r; try { r = await request({ method, url: t.url, headers, file, body, toFile }); } catch (e) { throw new Error(netProblem(e, 'the storage service') || `Could not talk to the storage service (${e.message}).`); }
    if (r.status === 403) { const code = (r.body.toString().match(/<Code>([^<]+)</) || [])[1]; throw new Error(code === 'SignatureDoesNotMatch' ? 'The secret key does not match the access key (or the region is wrong).' : code === 'InvalidAccessKeyId' ? 'The access key was not recognised.' : 'The storage service refused access. Check the keys and that they may use this bucket.'); }
    if (r.status === 404 && /NoSuchBucket/.test(r.body.toString())) throw new Error(`The bucket "${s.bucket}" was not found.`);
    return r;
  }
  return {
    type: 's3',
    async put(local, name) {
      const hashes = await hashFile(local), r = await call('PUT', keyOf(name), { file: local, hashes });
      if (r.status >= 300) throw new Error(`The storage service did not accept the file (it answered ${r.status}).`);
      const etag = String(r.headers.etag || '').replace(/"/g, ''), checked = /^[0-9a-f]{32}$/.test(etag);
      if (checked && etag !== hashes.md5) throw new Error('The storage service reports a different checksum from the file that was sent.');
      return { size: fs.statSync(local).size, hashChecked: checked };
    },
    async list() {
      const out = []; let token = '';
      for (;;) {
        const r = await call('GET', '', { query: { 'list-type': '2', prefix: prefix ? prefix + '/' : '', ...(token ? { 'continuation-token': token } : {}) } });
        if (r.status >= 300) throw new Error(`The storage service could not list the files (it answered ${r.status}).`);
        const x = r.body.toString();
        for (const m of x.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) { const k = (m[1].match(/<Key>([^<]*)</) || [])[1] || '', size = Number((m[1].match(/<Size>(\d+)</) || [])[1]), lm = (m[1].match(/<LastModified>([^<]*)</) || [])[1]; const nm = k.slice(prefix ? prefix.length + 1 : 0); if (nm && !nm.includes('/')) out.push({ name: nm, size, mtime: lm ? Date.parse(lm) : 0 }); }
        token = /<IsTruncated>true</.test(x) ? (x.match(/<NextContinuationToken>([^<]*)</) || [])[1] : ''; if (!token) break;
      }
      return out;
    },
    async stat(name) { const r = await call('HEAD', keyOf(name)); if (r.status === 404) return null; if (r.status >= 300) throw new Error(`The storage service could not check the file (it answered ${r.status}).`); return { size: Number(r.headers['content-length']) }; },
    async remove(name) { const r = await call('DELETE', keyOf(name)); if (r.status >= 300 && r.status !== 404) throw new Error(`The storage service could not delete the file (it answered ${r.status}).`); },
    async get(name, dest) { const r = await call('GET', keyOf(name), { toFile: dest }); if (r.status >= 300) throw new Error(`The storage service could not send the file (it answered ${r.status}).`); },
    close() {},
  };
}
