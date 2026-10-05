// SERVICES / backup / bundle — one encrypted file holding the whole site: database + encryption key + manifest.
// Restoring it on an empty server brings every account back exactly as it was (passwords, two-factor, plans, settings).
// The passphrase is chosen by the person making the backup, is never stored, and never appears in logs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from '../../core/config.mjs';
import { exportKey } from '../../auth/secrets.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { createBackup } from './create.mjs';
import { backupDir } from './files.mjs';
import { writeRestoreNote } from './restore-note.mjs';

const L = areaLogger('backup');
const MAGIC = Buffer.from('MBSBAK1\n');
export const MIN_PASSPHRASE = 12;
const KDF = { N: 1 << 15, r: 8, p: 1 };
const derive = (pass, salt) => crypto.scryptSync(pass, salt, 32, { ...KDF, maxmem: 128 * 1024 * 1024 });

const pack = (entries) => zlib.gzipSync(Buffer.concat(entries.flatMap(([name, buf]) => {
  const n = Buffer.from(name), h = Buffer.alloc(12); h.writeUInt32BE(n.length, 0); h.writeBigUInt64BE(BigInt(buf.length), 4); return [h, n, buf];
})));
function unpack(gz) {
  const b = zlib.gunzipSync(gz), out = {}; let o = 0;
  while (o < b.length) { const nl = b.readUInt32BE(o), size = Number(b.readBigUInt64BE(o + 4)); o += 12; const name = b.toString('utf8', o, o + nl); o += nl; out[name] = b.subarray(o, o + size); o += size; }
  return out;
}

export function sealBundle(entries, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', derive(passphrase, salt), iv);
  const header = Buffer.from(JSON.stringify({ kdf: 'scrypt', ...KDF, salt: salt.toString('base64'), iv: iv.toString('base64') })), lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(header.length);
  c.setAAD(header);
  const body = Buffer.concat([c.update(pack(entries)), c.final()]);
  return Buffer.concat([MAGIC, lenBuf, header, body, c.getAuthTag()]);
}
// Throws a plain-English error for a wrong passphrase or a damaged / foreign file.
export function openBundle(file, passphrase) {
  if (file.length < MAGIC.length + 4 + 16 || !file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('This is not a myBoxStock full-site backup.');
  const hl = file.readUInt32BE(MAGIC.length), header = file.subarray(MAGIC.length + 4, MAGIC.length + 4 + hl), h = JSON.parse(header.toString());
  const body = file.subarray(MAGIC.length + 4 + hl, file.length - 16), tag = file.subarray(file.length - 16);
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(passphrase, Buffer.from(h.salt, 'base64'), 32, { N: h.N, r: h.r, p: h.p, maxmem: 128 * 1024 * 1024 }), Buffer.from(h.iv, 'base64'));
    d.setAAD(header); d.setAuthTag(tag);
    return unpack(Buffer.concat([d.update(body), d.final()]));
  } catch { throw new Error('Wrong passphrase, or the backup file is damaged.'); }
}

export async function createBundle(db, passphrase, actor = null, tag = '') {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE) throw new Error(`The backup passphrase must be at least ${MIN_PASSPHRASE} characters.`);
  const snap = await createBackup(db, 'bundle-temp', actor), snapPath = path.join(backupDir(), snap);
  try {
    const manifest = { format: 1, app: 'myBoxStock', version: config.version, engine: db.client, createdAt: new Date().toISOString(), database: db.client === 'sqlite' ? 'database.db' : 'database.sql' };
    const entries = [['manifest.json', Buffer.from(JSON.stringify(manifest, null, 2))], [manifest.database, fs.readFileSync(snapPath)], ['secret.key', Buffer.from(exportKey())]];
    const name = `myboxstock-fullsite${tag ? '-' + tag : ''}-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.mbsbak`, out = path.join(backupDir(), name);
    fs.writeFileSync(out, sealBundle(entries, passphrase), { mode: 0o600 });
    L.info('bundle.created', `Full-site backup ${name} created (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${db.client})`, { actor, data: { name, engine: db.client } });
    return name;
  } finally { fs.rmSync(snapPath, { force: true }); }
}

// Offline restore into DATA_DIR (used by `node server.mjs restore-bundle` on a new or empty server).
export function restoreBundleToDisk(file, passphrase, { force = false } = {}) {
  const e = openBundle(fs.readFileSync(file), passphrase), m = JSON.parse(e['manifest.json'].toString());
  fs.mkdirSync(config.dataDir, { recursive: true });
  const keyFile = path.join(config.dataDir, 'secret.key');
  if (m.engine === 'sqlite') {
    const dbFile = path.join(config.dataDir, 'myboxstock.db');
    if (fs.existsSync(dbFile) && !force) throw new Error('This server already has data. Use --force to replace it (the current database is kept as a copy).');
    if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, dbFile + `.before-restore-${Date.now()}`);
    for (const x of ['-wal', '-shm']) fs.rmSync(dbFile + x, { force: true });
    fs.writeFileSync(dbFile, e['database.db']);
  } else fs.writeFileSync(path.join(config.dataDir, 'restored-dump.sql'), e['database.sql']);
  fs.writeFileSync(keyFile, e['secret.key'].toString(), { mode: 0o600 });
  L.warn('bundle.restored', `Full-site backup restored to ${config.dataDir} (${m.engine}, made ${m.createdAt})`, { data: { engine: m.engine, createdAt: m.createdAt } });
  return m;
}

// Console restore: stage database + key, applied at next start by applyPendingRestore (SQLite only).
export function stageBundleRestore(file, passphrase, actor) {
  const e = openBundle(fs.readFileSync(file), passphrase), m = JSON.parse(e['manifest.json'].toString());
  if (m.engine !== 'sqlite') throw new Error('This backup holds a database dump. Restore it with psql / mysql on the new server (see the Backups page).');
  fs.writeFileSync(path.join(config.dataDir, 'restore-pending.db'), e['database.db']);
  fs.writeFileSync(path.join(config.dataDir, 'restore-pending.key'), e['secret.key'].toString(), { mode: 0o600 });
  writeRestoreNote({ name: path.basename(file), takenAt: Date.parse(m.createdAt) || fs.statSync(file).mtimeMs });
  L.warn('restore.staged', `Full-site restore of ${path.basename(file)} staged; the server will restart to apply it`, { actor });
}
