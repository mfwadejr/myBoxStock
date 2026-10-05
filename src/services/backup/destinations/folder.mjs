// SERVICES / backup / destinations / folder — a folder on this server or on a drive/NAS mounted into the container.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha = (f) => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', (c) => h.update(c)).on('end', () => res(h.digest('hex'))).on('error', rej); });

export function folderClient(s) {
  const dir = s.path, p = (n) => path.join(dir, n);
  const wrap = (e) => { throw new Error(e.code === 'EACCES' ? `This server is not allowed to write to ${dir}.` : e.code === 'ENOSPC' ? `There is no space left in ${dir}.` : e.code === 'ENOENT' || e.code === 'ENOTDIR' ? `The folder ${dir} could not be used. Check the path.` : e.code === 'EROFS' ? `${dir} is read-only.` : `The folder ${dir} could not be used (${e.message}).`); };
  return {
    type: 'folder',
    async put(local, name) {
      try {
        fs.mkdirSync(dir, { recursive: true }); const tmp = p(name + '.part');
        fs.copyFileSync(local, tmp); fs.renameSync(tmp, p(name));
        const same = (await sha(local)) === (await sha(p(name)));
        if (!same) throw Object.assign(new Error(`The copy in ${dir} does not match the original.`), { plain: true });
        return { size: fs.statSync(p(name)).size, hashChecked: true };
      } catch (e) { if (e.plain) throw e; wrap(e); }
    },
    async list() { try { fs.mkdirSync(dir, { recursive: true }); return fs.readdirSync(dir).filter(f => !f.endsWith('.part')).map(f => { const st = fs.statSync(p(f)); return st.isFile() ? { name: f, size: st.size, mtime: st.mtimeMs } : null; }).filter(Boolean); } catch (e) { wrap(e); } },
    async stat(name) { try { const st = fs.statSync(p(name)); return { size: st.size }; } catch { return null; } },
    async remove(name) { try { fs.rmSync(p(name), { force: true }); } catch (e) { wrap(e); } },
    async get(name, dest) { try { fs.copyFileSync(p(name), dest); } catch (e) { wrap(e); } },
    close() {},
  };
}
