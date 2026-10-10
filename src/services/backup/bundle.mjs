// SERVICES / backup / bundle — one encrypted file holding the whole site: database + encryption key + manifest.
// Restoring it on an empty server brings every account back exactly as it was (passwords, two-factor, plans, settings).
// The passphrase is chosen by the person making the backup, is never stored, and never appears in logs.
// Two file formats are read: "MBSBAK1" (older, one sealed block) and "MBSBAK2" (new files: gzip + AES-256-GCM in 1 MiB chunks, the same
// chunking as the .mbsenc copies). New files are always MBSBAK2 and are written and opened as streams, a chunk at a time, so memory stays flat
// however large the database is. Opening never uses anything before the whole file has passed its authentication: the parts are written to a
// scratch folder and the caller gets them only after the last chunk (or the single tag of an older file) has checked out.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../../core/config.mjs';
import { exportKey } from '../../auth/secrets.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { createBackup } from './create.mjs';
import { backupDir } from './files.mjs';
import { writeRestoreNote } from './restore-note.mjs';
import { encryptStreamTo, decryptStreamTo } from './crypt.mjs';
import { jobBytes, jobStep } from './progress.mjs';
import { stripDemoFromSnapshot } from '../demo/strip.mjs';

const L = areaLogger('backup');
const MAGIC = Buffer.from('MBSBAK1\n'), MAGIC2 = Buffer.from('MBSBAK2\n');
export const MIN_PASSPHRASE = 12;
export const BAD_PASSPHRASE = 'Wrong passphrase, or the backup file is damaged.';
export const NOT_A_BUNDLE = 'This is not a myBoxStock full-site backup.';
const KDF = { N: 1 << 15, r: 8, p: 1 };
const derive = (pass, salt) => crypto.scryptSync(pass, salt, 32, { ...KDF, maxmem: 128 * 1024 * 1024 });
const PARTS = new Set(['manifest.json', 'database.db', 'database.sql', 'secret.key']);

const entryHead = (name, size) => { const n = Buffer.from(name), h = Buffer.alloc(12); h.writeUInt32BE(n.length, 0); h.writeBigUInt64BE(BigInt(size), 4); return Buffer.concat([h, n]); };
const pack = (entries) => zlib.gzipSync(Buffer.concat(entries.flatMap(([name, buf]) => [entryHead(name, buf.length), buf])));
function unpack(gz) {
  const b = zlib.gunzipSync(gz), out = {}; let o = 0;
  while (o < b.length) { const nl = b.readUInt32BE(o), size = Number(b.readBigUInt64BE(o + 4)); o += 12; const name = b.toString('utf8', o, o + nl); o += nl; out[name] = b.subarray(o, o + size); o += size; }
  return out;
}
// The plain stream of a bundle: each part is a Buffer or { file, size } (read from disk in pieces, never loaded whole).
async function* packStream(entries) {
  const total = entries.reduce((n, [, p]) => n + (Buffer.isBuffer(p) ? p.length : p.size), 0); let done = 0;
  for (const [name, part] of entries) {
    if (Buffer.isBuffer(part)) { yield entryHead(name, part.length); yield part; done += part.length; continue; }
    yield entryHead(name, part.size); let sent = 0;
    for await (const c of fs.createReadStream(part.file)) { sent += c.length; done += c.length; jobBytes(done, total); yield c; }
    if (sent !== part.size) throw new Error('The snapshot changed while it was being packed.');
  }
}
// Writes the parts of a plain bundle stream into a folder, one file each, a piece at a time.
class Unpack extends Writable {
  constructor(dir) { super(); this.dir = dir; this.files = {}; this.st = 'head'; this.acc = Buffer.alloc(0); this.out = null; this.left = 0; this.nl = 0; this.size = 0; }
  async _write(chunk, _enc, cb) {
    try {
      let b = chunk;
      while (b.length) {
        if (this.st === 'body') {
          if (this.destroyed) return cb();
          const n = Math.min(this.left, b.length); await new Promise((res, rej) => this.out.write(b.subarray(0, n), (e) => e ? rej(e) : res()));
          this.left -= n; b = b.subarray(n); if (!this.left) await this.closePart(); continue;
        }
        const want = this.st === 'head' ? 12 : this.nl, take = Math.min(want - this.acc.length, b.length);
        this.acc = Buffer.concat([this.acc, b.subarray(0, take)]); b = b.subarray(take); if (this.acc.length < want) continue;
        if (this.st === 'head') {
          this.nl = this.acc.readUInt32BE(0); this.size = Number(this.acc.readBigUInt64BE(4)); this.acc = Buffer.alloc(0);
          if (!this.nl || this.nl > 64) throw new Error('bad part name'); this.st = 'name';
        } else {
          const name = this.acc.toString('utf8'); this.acc = Buffer.alloc(0);
          if (!PARTS.has(name) || this.files[name]) throw new Error('unexpected part');
          const file = path.join(this.dir, name); this.files[name] = file; this.left = this.size; this.out = fs.createWriteStream(file, { mode: 0o600 }); this.out.on('error', () => {}); // a failure reaches the write callback; the event alone must not crash
          if (!this.left) await this.closePart(); else this.st = 'body';
        }
      }
      cb();
    } catch (e) { cb(e); }
  }
  closePart() { const o = this.out; this.out = null; this.st = 'head'; return new Promise((res, rej) => o.end((e) => e ? rej(e) : res())); }
  _final(cb) { if (this.st !== 'head' || this.acc.length) return cb(new Error('cut short')); cb(); }
  _destroy(e, cb) { if (this.out) this.out.destroy(); cb(e); }
}

// The older single-block format, still written by tests and tools that hold a small file in memory, and always readable.
export function sealBundle(entries, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', derive(passphrase, salt), iv);
  const header = Buffer.from(JSON.stringify({ kdf: 'scrypt', ...KDF, salt: salt.toString('base64'), iv: iv.toString('base64') })), lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(header.length);
  c.setAAD(header);
  const body = Buffer.concat([c.update(pack(entries)), c.final()]);
  return Buffer.concat([MAGIC, lenBuf, header, body, c.getAuthTag()]);
}
// Opens an older (MBSBAK1) file held in memory. The app itself opens files with extractBundle, which streams.
export function openBundle(file, passphrase) {
  if (file.length < MAGIC.length + 4 + 16 || !file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error(NOT_A_BUNDLE);
  const hl = file.readUInt32BE(MAGIC.length), header = file.subarray(MAGIC.length + 4, MAGIC.length + 4 + hl), h = JSON.parse(header.toString());
  const body = file.subarray(MAGIC.length + 4 + hl, file.length - 16), tag = file.subarray(file.length - 16);
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(passphrase, Buffer.from(h.salt, 'base64'), 32, { N: h.N, r: h.r, p: h.p, maxmem: 128 * 1024 * 1024 }), Buffer.from(h.iv, 'base64'));
    d.setAAD(header); d.setAuthTag(tag);
    return unpack(Buffer.concat([d.update(body), d.final()]));
  } catch { throw new Error(BAD_PASSPHRASE); }
}

// Streams an older (MBSBAK1) file through the same single tag check, writing the parts to a folder.
async function streamV1(file, passphrase, sink) {
  const fd = await fs.promises.open(file, 'r');
  try {
    const st = await fd.stat(), head = Buffer.alloc(MAGIC.length + 4);
    if (st.size < head.length + 16) throw new Error(NOT_A_BUNDLE);
    await fd.read(head, 0, head.length, 0);
    const hl = head.readUInt32BE(MAGIC.length); if (hl > 4096 || head.length + hl + 16 > st.size) throw new Error(NOT_A_BUNDLE);
    const header = Buffer.alloc(hl), tag = Buffer.alloc(16); await fd.read(header, 0, hl, head.length); await fd.read(tag, 0, 16, st.size - 16);
    const start = head.length + hl, end = st.size - 17;
    try {
      const h = JSON.parse(header.toString()), d = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(passphrase, Buffer.from(h.salt, 'base64'), 32, { N: h.N, r: h.r, p: h.p, maxmem: 128 * 1024 * 1024 }), Buffer.from(h.iv, 'base64'));
      d.setAAD(header); d.setAuthTag(tag);
      if (end < start) throw new Error('empty');
      await pipeline(fs.createReadStream(file, { start, end }), d, zlib.createGunzip(), sink);
    } catch { throw new Error(BAD_PASSPHRASE); }
  } finally { await fd.close(); }
}

// Opens a full-site backup (either format) into a scratch folder, streaming. Resolves only after the WHOLE file has authenticated; until then the
// folder holds unverified bytes that nothing may use. On any failure the folder's contents are removed and a plain-English error is thrown.
// Returns { manifest, files: { 'manifest.json'|'database.db'|'database.sql'|'secret.key': path }, dir, format, cleanup() }.
export async function extractBundle(file, passphrase, { dir = null } = {}) {
  const own = !dir; dir = dir || fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-bundle-'));
  const sink = new Unpack(dir), cleanup = () => { for (const f of Object.values(sink.files)) fs.rmSync(f, { force: true }); if (own) fs.rmSync(dir, { recursive: true, force: true }); };
  try {
    const fd = await fs.promises.open(file, 'r'), m = Buffer.alloc(8); let got = 0;
    try { got = (await fd.read(m, 0, 8, 0)).bytesRead; } finally { await fd.close(); }
    const v2 = got === 8 && m.equals(MAGIC2);
    if (!v2 && !(got === 8 && m.equals(MAGIC))) throw new Error(NOT_A_BUNDLE);
    if (typeof passphrase !== 'string' || !passphrase) throw new Error(BAD_PASSPHRASE);
    if (v2) await decryptStreamTo(file, sink, passphrase, { magic: MAGIC2, notMine: NOT_A_BUNDLE, damaged: BAD_PASSPHRASE }); else await streamV1(file, passphrase, sink);
    const mf = sink.files['manifest.json'];
    if (!mf || fs.statSync(mf).size > 1 << 20) throw new Error(BAD_PASSPHRASE);
    let manifest; try { manifest = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch { throw new Error(BAD_PASSPHRASE); }
    return { manifest, files: sink.files, dir, format: v2 ? 2 : 1, cleanup };
  } catch (e) { cleanup(); throw e; }
}
export const readPart = (x, name, max = 1 << 20) => { const f = x.files[name]; if (!f) return null; const size = fs.statSync(f).size; return size > max ? fs.readFileSync(f).subarray(0, max) : fs.readFileSync(f); };
export const keyOf = (x) => { const f = x.files['secret.key']; return f && fs.statSync(f).size < 65536 ? fs.readFileSync(f, 'utf8') : ''; };
// First bytes of a text part (for "does the dump have tables").
export function peekPart(x, name, n = 200000) { const f = x.files[name]; if (!f) return ''; const fd = fs.openSync(f, 'r'); try { const b = Buffer.alloc(n), r = fs.readSync(fd, b, 0, n, 0); return b.toString('utf8', 0, r); } finally { fs.closeSync(fd); } }

// Writes a bundle file: entries are [name, Buffer | { file, size }]. Streams; the temporary name is not listed as a backup until the file is whole.
export async function writeBundleFile(entries, dest, passphrase) {
  const part = dest + '.partial';
  try { await encryptStreamTo(Readable.from(packStream(entries)), part, passphrase, MAGIC2); fs.renameSync(part, dest); } catch (e) { fs.rmSync(part, { force: true }); throw e; }
}

export async function createBundle(db, passphrase, actor = null, tag = '') {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE) throw new Error(`The backup passphrase must be at least ${MIN_PASSPHRASE} characters.`);
  jobStep('Taking a snapshot of the database', 2, 15);
  const snap = await createBackup(db, 'bundle-temp', actor), snapPath = path.join(backupDir(), snap);
  try {
    const left = await stripDemoFromSnapshot(db, snapPath);   // demo accounts are left out of the copy (never out of the live site), unless the Demo mode setting says otherwise
    const manifest = { format: 2, app: 'myBoxStock', version: config.version, engine: db.client, createdAt: new Date().toISOString(), database: db.client === 'sqlite' ? 'database.db' : 'database.sql', ...(left?.removed ? { demoAccountsLeftOut: left.removed } : {}) };
    const entries = [['manifest.json', Buffer.from(JSON.stringify(manifest, null, 2))], [manifest.database, { file: snapPath, size: fs.statSync(snapPath).size }], ['secret.key', Buffer.from(exportKey())]];
    const name = `myboxstock-fullsite${tag ? '-' + tag : ''}-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.mbsbak`, out = path.join(backupDir(), name);
    jobStep('Writing the encrypted file', 15, 85); await writeBundleFile(entries, out, passphrase);
    L.info('bundle.created', `Full-site backup ${name} created (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${db.client}, streamed)`, { actor, data: { name, engine: db.client, format: 2 } });
    return name;
  } finally { fs.rmSync(snapPath, { force: true }); }
}

// Offline restore into DATA_DIR (used by `node server.mjs restore-bundle` on a new or empty server).
export async function restoreBundleToDisk(file, passphrase, { force = false } = {}) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const x = await extractBundle(file, passphrase, { dir: fs.mkdtempSync(path.join(config.dataDir, 'restore-work-')) }), m = x.manifest;
  try {
    const keyFile = path.join(config.dataDir, 'secret.key');
    if (m.engine === 'sqlite') {
      const dbFile = path.join(config.dataDir, 'myboxstock.db');
      if (fs.existsSync(dbFile) && !force) throw new Error('This server already has data. Use --force to replace it (the current database is kept as a copy).');
      if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, dbFile + `.before-restore-${Date.now()}`);
      for (const y of ['-wal', '-shm']) fs.rmSync(dbFile + y, { force: true });
      fs.renameSync(x.files['database.db'], dbFile);
    } else fs.renameSync(x.files['database.sql'], path.join(config.dataDir, 'restored-dump.sql'));
    fs.writeFileSync(keyFile, keyOf(x), { mode: 0o600 });
  } finally { fs.rmSync(x.dir, { recursive: true, force: true }); }
  L.warn('bundle.restored', `Full-site backup restored to ${config.dataDir} (${m.engine}, made ${m.createdAt})`, { data: { engine: m.engine, createdAt: m.createdAt } });
  return m;
}

// Console restore: stage database + key, applied at next start by applyPendingRestore (SQLite only). `x` is an extractBundle result that has already authenticated.
export function stageExtracted(x, { name, actor, takenAt = 0 }) {
  const m = x.manifest;
  if (m.engine !== 'sqlite') throw new Error('This backup holds a database dump. Restore it with psql / mysql on the new server (see the Backups page).');
  const key = keyOf(x); if (!key) throw new Error('The backup has no key, so it cannot be restored.');
  fs.mkdirSync(config.dataDir, { recursive: true });
  const keyP = path.join(config.dataDir, 'restore-pending.key'), dbP = path.join(config.dataDir, 'restore-pending.db'), part = dbP + '.part';
  fs.writeFileSync(keyP, key, { mode: 0o600 });
  try { fs.renameSync(x.files['database.db'], part); } catch { fs.copyFileSync(x.files['database.db'], part); } // another disk: copy instead of move
  fs.renameSync(part, dbP); // the key is in place first, so the database never starts without it
  writeRestoreNote({ name, takenAt: takenAt || Date.parse(m.createdAt) || Date.now() });
  L.warn('restore.staged', `Full-site restore of ${name} staged; the server will restart to apply it`, { actor, data: { name } });
}
export async function stageBundleRestore(file, passphrase, actor) {
  const x = await extractBundle(file, passphrase, { dir: (fs.mkdirSync(config.dataDir, { recursive: true }), fs.mkdtempSync(path.join(config.dataDir, 'restore-work-'))) });
  try { stageExtracted(x, { name: path.basename(file), actor, takenAt: Date.parse(x.manifest.createdAt) || fs.statSync(file).mtimeMs }); } finally { fs.rmSync(x.dir, { recursive: true, force: true }); }
}
