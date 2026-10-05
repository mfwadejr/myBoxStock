// SERVICES / backup / destinations / webdav — a WebDAV server (Nextcloud, ownCloud, many NAS boxes) with basic sign-in.
import { request, netProblem } from './http.mjs';

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
export function webdavClient(s, secrets) {
  const base = s.url.replace(/\/+$/, ''), auth = 'Basic ' + Buffer.from(`${s.username}:${secrets.password || ''}`).toString('base64');
  const folder = (s.folder || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const url = (n = '') => `${base}${folder ? '/' + folder : ''}${n ? '/' + encodeURIComponent(n) : '/'}`;
  const call = async (o) => {
    let r; try { r = await request({ ...o, headers: { authorization: auth, ...(o.headers || {}) } }); } catch (e) { throw new Error(netProblem(e, 'the WebDAV server') || `Could not talk to the WebDAV server (${e.message}).`); }
    if (r.status === 401 || r.status === 403) throw new Error(r.status === 401 ? 'The WebDAV server did not accept the user name and password.' : 'The WebDAV server says this user is not allowed to do that.');
    return r;
  };
  async function ensureFolder() {
    let acc = base; for (const seg of (s.folder || '').split('/').filter(Boolean)) { acc += '/' + encodeURIComponent(seg); const r = await call({ method: 'MKCOL', url: acc + '/' }); if (![200, 201, 301, 405].includes(r.status)) throw new Error(`The WebDAV folder could not be created (the server answered ${r.status}).`); }
  }
  const parse = (xml) => [...xml.matchAll(/<(?:\w+:)?response[\s>][\s\S]*?<\/(?:\w+:)?response>/gi)].map(m => m[0]).map(b => {
    const href = decode((b.match(/<(?:\w+:)?href[^>]*>([\s\S]*?)<\/(?:\w+:)?href>/i) || [])[1] || ''), size = (b.match(/<(?:\w+:)?getcontentlength[^>]*>(\d+)</i) || [])[1], mod = (b.match(/<(?:\w+:)?getlastmodified[^>]*>([^<]+)</i) || [])[1], isDir = /<(?:\w+:)?collection\s*\/?>/i.test(b);
    return { name: decodeURIComponent(href.replace(/\/+$/, '').split('/').pop() || ''), size: size == null ? null : Number(size), mtime: mod ? Date.parse(mod) : 0, isDir };
  });
  return {
    type: 'webdav',
    async put(local, name) {
      await ensureFolder();
      const r = await call({ method: 'PUT', url: url(name), file: local, headers: { 'content-type': 'application/octet-stream' } });
      if (r.status >= 300) throw new Error(`The WebDAV server did not accept the file (it answered ${r.status}).`);
      const st = await this.stat(name); return { size: st?.size ?? null, hashChecked: false };
    },
    async list() {
      const r = await call({ method: 'PROPFIND', url: url(), headers: { depth: '1', 'content-type': 'application/xml' }, body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><getcontentlength/><getlastmodified/><resourcetype/></prop></propfind>' });
      if (r.status === 404) return [];
      if (r.status >= 400) throw new Error(`The WebDAV server could not list the folder (it answered ${r.status}).`);
      return parse(r.body.toString()).filter(x => x.name && !x.isDir);
    },
    async stat(name) {
      const r = await call({ method: 'PROPFIND', url: url(name), headers: { depth: '0', 'content-type': 'application/xml' }, body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><getcontentlength/></prop></propfind>' });
      if (r.status === 404) return null; if (r.status >= 400) throw new Error(`The WebDAV server could not check the file (it answered ${r.status}).`);
      const x = parse(r.body.toString())[0]; return x ? { size: x.size } : null;
    },
    async remove(name) { const r = await call({ method: 'DELETE', url: url(name) }); if (r.status >= 400 && r.status !== 404) throw new Error(`The WebDAV server could not delete the file (it answered ${r.status}).`); },
    async get(name, dest) { const r = await call({ method: 'GET', url: url(name), toFile: dest }); if (r.status >= 300) throw new Error(`The WebDAV server could not send the file (it answered ${r.status}).`); },
    close() {},
  };
}
