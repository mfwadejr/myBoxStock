// SERVICES / backup / destinations / sftp — a server reached over SSH file transfer, with the pure-JavaScript `ssh2` package.
// The server's host key is pinned: the first successful "Test connection" records its fingerprint, and every later connection must match it.
import path from 'node:path';

export const fingerprintOf = (hexSha256) => 'SHA256:' + Buffer.from(hexSha256, 'hex').toString('base64').replace(/=+$/, '');
const pathOf = (folder, name) => path.posix.join(folder || '.', name);

// deps.ssh2 lets tests supply a stand-in; `pinned` is the stored fingerprint ('' = none yet, only allowed when learning during a test).
export function sftpClient(s, secrets, { pinned = '', learn = false, ssh2 = null, onFingerprint = () => {} } = {}) {
  const wrap = (e) => {
    if (e?.plain) return e; const m = String(e?.message || e), c = e?.code;
    if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return Object.assign(new Error('Could not find the server. Check the address for typing mistakes.'), { plain: true });
    if (c === 'ECONNREFUSED') return Object.assign(new Error('The server refused the connection. Check the address and port.'), { plain: true });
    if (c === 'ETIMEDOUT' || /Timed out|timeout/i.test(m)) return Object.assign(new Error('Could not reach the server (it did not answer).'), { plain: true });
    if (/authentication/i.test(m)) return Object.assign(new Error('The server did not accept the user name and password / key.'), { plain: true });
    if (/No such file/i.test(m)) return Object.assign(new Error('The folder was not found on the server.'), { plain: true });
    if (/Permission denied/i.test(m)) return Object.assign(new Error('This user is not allowed to write in that folder.'), { plain: true });
    return Object.assign(new Error(`The SFTP server reported a problem (${m}).`), { plain: true });
  };
  async function open() {
    const lib = ssh2 || (await import('ssh2')).default || (await import('ssh2'));
    return new Promise((resolve, reject) => {
      const conn = new lib.Client(); let mismatch = false;
      conn.on('ready', () => conn.sftp((err, sftp) => err ? (conn.end(), reject(wrap(err))) : resolve({ conn, sftp })));
      conn.on('error', (e) => reject(mismatch ? Object.assign(new Error('The server\'s identity (host key) is not the one that was saved. If the server was rebuilt on purpose, remove this destination and add it again; otherwise someone may be impersonating it.'), { plain: true, hostKey: true }) : wrap(e)));
      conn.connect({
        host: s.host, port: Number(s.port) || 22, username: s.username, readyTimeout: 20000, hostHash: 'sha256',
        ...(secrets.privateKey ? { privateKey: secrets.privateKey, passphrase: secrets.keyPassphrase || undefined } : { password: secrets.password || '' }),
        hostVerifier: (hash) => { const fp = fingerprintOf(hash); if (pinned) { if (fp === pinned) return true; mismatch = true; return false; } if (learn) { onFingerprint(fp); return true; } mismatch = true; return false; },
      });
    });
  }
  const call = (sftp, fn, ...a) => new Promise((res, rej) => sftp[fn](...a, (e, r) => e ? rej(e) : res(r)));
  async function use(fn) {
    if (!pinned && !learn) throw Object.assign(new Error('The server\'s identity has not been recorded yet. Press "Test connection" first.'), { plain: true });
    let h; try { h = await open(); return await fn(h.sftp); } catch (e) { throw wrap(e); } finally { h?.conn.end(); }
  }
  async function ensureDir(sftp) {
    let acc = s.folder?.startsWith('/') ? '/' : '';
    for (const seg of (s.folder || '').split('/').filter(Boolean)) { acc = path.posix.join(acc || '.', seg); try { await call(sftp, 'stat', acc); } catch { await call(sftp, 'mkdir', acc); } }
  }
  return {
    type: 'sftp',
    put: (local, name) => use(async (sftp) => { await ensureDir(sftp); const dest = pathOf(s.folder, name); await call(sftp, 'fastPut', local, dest); const st = await call(sftp, 'stat', dest); return { size: st.size, hashChecked: false }; }),
    list: () => use(async (sftp) => { try { return (await call(sftp, 'readdir', s.folder || '.')).filter(f => f.attrs.isFile?.() ?? !String(f.longname).startsWith('d')).map(f => ({ name: f.filename, size: f.attrs.size, mtime: (f.attrs.mtime || 0) * 1000 })); } catch (e) { if (/No such file/i.test(e.message)) return []; throw e; } }),
    stat: (name) => use(async (sftp) => { try { const st = await call(sftp, 'stat', pathOf(s.folder, name)); return { size: st.size }; } catch { return null; } }),
    remove: (name) => use(async (sftp) => { try { await call(sftp, 'unlink', pathOf(s.folder, name)); } catch (e) { if (!/No such file/i.test(e.message)) throw e; } }),
    get: (name, dest) => use((sftp) => call(sftp, 'fastGet', pathOf(s.folder, name), dest)),
    close() {},
  };
}
