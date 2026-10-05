// TEST / helpers-backup-sims — small stand-in servers for the backup destinations: S3-compatible, WebDAV and SFTP (ssh2's own server class).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import ssh2 from 'ssh2';
import { signV4 } from '../src/services/backup/destinations/s3.mjs';

const listen = (srv) => new Promise((res) => srv.listen(0, '127.0.0.1', () => res(srv.address().port)));
const body = (req) => new Promise((res) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });

// Path-style S3 for one bucket. Checks the SigV4 signature on every request by signing the same request itself.
export async function s3Sim({ bucket = 'bkt', access = 'AKIATEST', secret = 'sekret/KEY', region = 'us-test-1' } = {}) {
  const store = new Map(), seen = [], fail = { next: 0 };
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), data = await body(req), h = req.headers;
    const query = Object.fromEntries(u.searchParams), amz = h['x-amz-date'] || '';
    const want = signV4({ method: req.method, host: h.host, path: u.pathname, query, payloadHash: h['x-amz-content-sha256'], accessKey: access, secretKey: secret, region, now: new Date(amz.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, '$1-$2-$3T$4:$5:$6Z')) }).headers.authorization;
    seen.push({ method: req.method, path: u.pathname, auth: h.authorization, payload: h['x-amz-content-sha256'], ok: want === h.authorization });
    if (want !== h.authorization) { res.writeHead(403); return res.end('<Error><Code>SignatureDoesNotMatch</Code></Error>'); }
    if (h['x-amz-content-sha256'] !== 'UNSIGNED-PAYLOAD' && req.method === 'PUT' && crypto.createHash('sha256').update(data).digest('hex') !== h['x-amz-content-sha256']) { res.writeHead(400); return res.end('bad payload'); }
    if (fail.next) { fail.next--; res.writeHead(500); return res.end('boom'); }
    const m = u.pathname.match(new RegExp(`^/${bucket}(?:/(.*))?$`)); if (!m) { res.writeHead(404); return res.end('<Error><Code>NoSuchBucket</Code></Error>'); }
    const key = decodeURIComponent(m[1] || '');
    if (req.method === 'PUT') { if (h['content-md5'] && crypto.createHash('md5').update(data).digest('base64') !== h['content-md5']) { res.writeHead(400); return res.end('md5'); } store.set(key, { data, t: Date.now() }); res.writeHead(200, { etag: `"${crypto.createHash('md5').update(data).digest('hex')}"` }); return res.end(); }
    if (req.method === 'GET' && !key) {
      const pre = query.prefix || ''; const items = [...store].filter(([k]) => k.startsWith(pre)).map(([k, v]) => `<Contents><Key>${k}</Key><LastModified>${new Date(v.t).toISOString()}</LastModified><Size>${v.data.length}</Size></Contents>`).join('');
      res.writeHead(200, { 'content-type': 'application/xml' }); return res.end(`<ListBucketResult><IsTruncated>false</IsTruncated>${items}</ListBucketResult>`);
    }
    if (req.method === 'GET') { const v = store.get(key); if (!v) { res.writeHead(404); return res.end(); } res.writeHead(200); return res.end(v.data); }
    if (req.method === 'HEAD') { const v = store.get(key); res.writeHead(v ? 200 : 404, v ? { 'content-length': v.data.length } : {}); return res.end(); }
    if (req.method === 'DELETE') { store.delete(key); res.writeHead(204); return res.end(); }
    res.writeHead(405); res.end();
  });
  const port = await listen(srv);
  return { endpoint: `http://127.0.0.1:${port}`, bucket, access, secret, region, store, seen, fail, close: () => srv.close() };
}

// WebDAV with basic sign-in: PUT, GET, DELETE, MKCOL, PROPFIND (depth 0 and 1) over a temp folder.
export async function davSim({ user = 'dav', pass = 'dav-pass' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-dav-')), seen = [];
  const srv = http.createServer(async (req, res) => {
    const data = await body(req), auth = req.headers.authorization || '';
    seen.push({ method: req.method, auth });
    if (auth !== 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')) { res.writeHead(401, { 'www-authenticate': 'Basic realm="x"' }); return res.end(); }
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname), p = path.join(root, rel);
    if (req.method === 'MKCOL') { if (fs.existsSync(p)) { res.writeHead(405); return res.end(); } fs.mkdirSync(p); res.writeHead(201); return res.end(); }
    if (req.method === 'PUT') { if (!fs.existsSync(path.dirname(p))) { res.writeHead(409); return res.end(); } fs.writeFileSync(p, data); res.writeHead(201); return res.end(); }
    if (req.method === 'GET') { if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200); return res.end(fs.readFileSync(p)); }
    if (req.method === 'DELETE') { fs.rmSync(p, { force: true }); res.writeHead(204); return res.end(); }
    if (req.method === 'PROPFIND') {
      if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
      const one = (href, st) => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${st.isDirectory() ? '<d:resourcetype><d:collection/></d:resourcetype>' : `<d:resourcetype/><d:getcontentlength>${st.size}</d:getcontentlength>`}<d:getlastmodified>${st.mtime.toUTCString()}</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
      let xml = one(req.url, fs.statSync(p));
      if (req.headers.depth === '1' && fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) xml += one(`${req.url.replace(/\/$/, '')}/${encodeURIComponent(f)}`, fs.statSync(path.join(p, f)));
      res.writeHead(207, { 'content-type': 'application/xml' }); return res.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${xml}</d:multistatus>`);
    }
    res.writeHead(405); res.end();
  });
  const port = await listen(srv);
  return { url: `http://127.0.0.1:${port}/dav`, user, pass, root, seen, init: () => fs.mkdirSync(path.join(root, 'dav'), { recursive: true }), close: () => { srv.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

// An SFTP server (password sign-in) that stores files in a temp folder. Every instance has its own host key (so a second instance looks like a replaced server).
export async function sftpSim({ user = 'sf', pass = 'sf-pass' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-sftp-')), { Server, utils } = ssh2, STATUS = utils.sftp.STATUS_CODE, OPEN = utils.sftp.OPEN_MODE;
  const key = utils.generateKeyPairSync('ed25519');
  const handles = new Map(); let hn = 0;
  const abs = (p) => path.join(root, path.posix.normalize('/' + p));
  const attrs = (st) => ({ mode: st.mode, uid: st.uid, gid: st.gid, size: st.size, atime: Math.floor(st.atimeMs / 1000), mtime: Math.floor(st.mtimeMs / 1000) });
  const connections = [];
  const srv = new Server({ hostKeys: [key.private] }, (client) => {
    connections.push(client);
    client.on('authentication', (ctx) => (ctx.method === 'password' && ctx.username === user && ctx.password === pass) ? ctx.accept() : ctx.reject(['password']));
    client.on('error', () => {});
    client.on('ready', () => client.on('session', (accept) => accept().on('sftp', (acceptSftp) => {
      const sftp = acceptSftp(), nofile = (id) => sftp.status(id, STATUS.NO_SUCH_FILE), ok = (id) => sftp.status(id, STATUS.OK);
      sftp.on('REALPATH', (id, p) => sftp.name(id, [{ filename: path.posix.normalize('/' + p), longname: p, attrs: {} }]));
      sftp.on('STAT', (id, p) => { try { sftp.attrs(id, attrs(fs.statSync(abs(p)))); } catch { nofile(id); } });
      sftp.on('LSTAT', (id, p) => { try { sftp.attrs(id, attrs(fs.statSync(abs(p)))); } catch { nofile(id); } });
      sftp.on('FSTAT', (id, h) => { const x = handles.get(h.toString()); if (!x?.fd) return nofile(id); sftp.attrs(id, attrs(fs.fstatSync(x.fd))); });
      sftp.on('MKDIR', (id, p) => { try { fs.mkdirSync(abs(p)); ok(id); } catch { sftp.status(id, STATUS.FAILURE); } });
      sftp.on('OPEN', (id, p, flags) => { try { const f = (flags & OPEN.WRITE) ? 'w' : 'r', fd = fs.openSync(abs(p), f), h = Buffer.from(String(++hn)); handles.set(h.toString(), { fd }); sftp.handle(id, h); } catch { nofile(id); } });
      sftp.on('WRITE', (id, h, off, data) => { fs.writeSync(handles.get(h.toString()).fd, data, 0, data.length, off); ok(id); });
      sftp.on('READ', (id, h, off, len) => { const b = Buffer.alloc(len), n = fs.readSync(handles.get(h.toString()).fd, b, 0, len, off); n ? sftp.data(id, b.subarray(0, n)) : sftp.status(id, STATUS.EOF); });
      sftp.on('FSETSTAT', (id) => ok(id)); sftp.on('SETSTAT', (id) => ok(id));
      sftp.on('CLOSE', (id, h) => { const x = handles.get(h.toString()); if (x?.fd) fs.closeSync(x.fd); handles.delete(h.toString()); ok(id); });
      sftp.on('REMOVE', (id, p) => { try { fs.unlinkSync(abs(p)); ok(id); } catch { nofile(id); } });
      sftp.on('OPENDIR', (id, p) => { try { fs.readdirSync(abs(p)); const h = Buffer.from(String(++hn)); handles.set(h.toString(), { dir: abs(p), done: false }); sftp.handle(id, h); } catch { nofile(id); } });
      sftp.on('READDIR', (id, h) => { const x = handles.get(h.toString()); if (!x || x.done) return sftp.status(id, STATUS.EOF); x.done = true; sftp.name(id, fs.readdirSync(x.dir).map(f => { const st = fs.statSync(path.join(x.dir, f)); return { filename: f, longname: `${st.isDirectory() ? 'd' : '-'}rw-r--r-- 1 u g ${st.size} Jan 1 00:00 ${f}`, attrs: attrs(st) }; })); });
    })));
  });
  const port = await listen(srv);
  return { port, user, pass, root, close: () => { for (const c of connections) c.end(); srv.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}
