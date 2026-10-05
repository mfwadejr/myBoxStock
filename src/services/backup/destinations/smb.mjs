// SERVICES / backup / destinations / smb — a Windows/NAS file share, reached with the `smbclient` command (no mounting, no extra privileges).
// The command is started with execFile (never a shell). The user name and password go in a temporary file (mode 0600, removed straight
// afterwards) read with `-A`; they are never on the command line and never logged. The command runner can be replaced in tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

export const defaultRunner = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  execFile(cmd, args, { timeout: opts.timeoutMs || 600000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err && err.code === 'ENOENT') return reject(Object.assign(new Error('The smbclient program is not installed in this container (the Docker image includes it as the package samba-client).'), { plain: true }));
    resolve({ stdout: String(stdout || ''), stderr: String(stderr || ''), code: err ? (typeof err.code === 'number' ? err.code : 1) : 0 });
  });
});
const SAFE = /^[^"\;\r\n\0]+$/; // anything smbclient could read as a second command or an escape is refused
const q = (s) => `"${s}"`;

export function plainSmbError(text) {
  const t = String(text);
  if (/LOGON_FAILURE|ACCESS_DENIED|ACCOUNT_DISABLED|WRONG_PASSWORD/.test(t)) return 'The share did not accept the user name and password (or this user is not allowed to use it).';
  if (/BAD_NETWORK_NAME/.test(t)) return 'The server is there, but it has no share with that name.';
  if (/OBJECT_NAME_NOT_FOUND|OBJECT_PATH_NOT_FOUND/.test(t)) return 'The folder was not found on the share.';
  if (/DISK_FULL|QUOTA/.test(t)) return 'The share is full.';
  if (/UNSUCCESSFUL|HOST_UNREACHABLE|NETWORK_UNREACHABLE|CONNECTION_REFUSED|Connection to .* failed|Unable to connect|resolve/i.test(t)) return 'Could not reach the server. Check the address and that this server can connect to it (port 445).';
  const m = t.match(/NT_STATUS_[A-Z_]+/); return `The share reported a problem (${m ? m[0] : 'unknown'}).`;
}

export function smbClient(s, secrets, { runner = defaultRunner } = {}) {
  for (const [k, v] of Object.entries({ host: s.host, share: s.share, folder: s.folder || '', domain: s.domain || '' })) if (v && !SAFE.test(v)) throw new Error(`The ${k} contains a character that is not allowed.`);
  const folder = (s.folder || '').split(/[\\/]+/).filter(Boolean), cd = folder.length ? `cd ${q(folder.join('/'))}; ` : '';
  async function smb(commands, { quiet = false } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-smb-')), file = path.join(dir, 'auth');
    try {
      fs.writeFileSync(file, `username = ${s.username}\npassword = ${secrets.password || ''}\n${s.domain ? `domain = ${s.domain}\n` : ''}`, { mode: 0o600, flag: 'wx' });
      const r = await runner('smbclient', [`//${s.host}/${s.share}`, '-A', file, '-c', commands], { timeoutMs: 600000 });
      const out = `${r.stdout}\n${r.stderr}`;
      if (!quiet && (r.code !== 0 || /NT_STATUS_[A-Z_]+/.test(out))) throw new Error(plainSmbError(out));
      return r;
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  const parseLs = (out) => out.split('\n').map(l => l.match(/^\s{2}(.+?)\s+([A-Za-z]+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s*$/)).filter(Boolean).filter(m => !m[2].includes('D') && m[1] !== '.' && m[1] !== '..').map(m => ({ name: m[1], size: Number(m[3]), mtime: Date.parse(m[4]) || 0 }));
  const need = (n) => { if (!SAFE.test(n)) throw new Error('That file name cannot be used on a share.'); return n; };
  return {
    type: 'smb',
    async put(local, name) {
      if (folder.length) await smb(folder.map((_, i) => `mkdir ${q(folder.slice(0, i + 1).join('/'))}`).join('; '), { quiet: true }); // folders that already exist are fine
      await smb(`${cd}put ${q(local)} ${q(need(name))}`);
      const st = await this.stat(name); return { size: st?.size ?? null, hashChecked: false };
    },
    async list() { const r = await smb(`${cd}ls`); return parseLs(r.stdout); },
    async stat(name) { return (await this.list()).find(f => f.name === name) || null; },
    async remove(name) { await smb(`${cd}del ${q(need(name))}`); },
    async get(name, dest) { await smb(`${cd}get ${q(need(name))} ${q(dest)}`); },
    close() {},
  };
}
