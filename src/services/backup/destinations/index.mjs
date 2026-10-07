// SERVICES / backup / destinations — the places backups are sent: a folder, an SMB share, S3-compatible storage, SFTP or WebDAV.
// Each destination is saved with its credentials sealed (same as the backup passphrase); the browser only ever sees "saved".
// Everything sent anywhere other than the default local folder is encrypted first with the backup passphrase (see crypt.mjs),
// and every upload is checked (size, plus a checksum where the protocol offers one) before anything local is trimmed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getSetting, setSetting } from '../../../db/settings.mjs';
import { seal, unseal } from '../../../auth/secrets.mjs';
import { areaLogger } from '../../../logging/logger.mjs';
import { backupDir, defaultBackupDir } from '../files.mjs';
import { encryptFile, ENC_EXT, isEncryptedName } from '../crypt.mjs';
import { getPassphrase } from '../passphrase.mjs';
import { assertPassphraseReady, coded } from '../gate.mjs';
import { folderClient } from './folder.mjs';
import { smbClient } from './smb.mjs';
import { s3Client } from './s3.mjs';
import { sftpClient } from './sftp.mjs';
import { webdavClient } from './webdav.mjs';

const L = areaLogger('backup');
export const hooks = { smbRunner: null, ssh2: null, now: null }; // tests replace these
const need = (v, what) => { if (!String(v ?? '').trim()) throw new Error(`Fill in the ${what}.`); return String(v).trim(); };
const absPath = (v) => { const p = need(v, 'folder path'); if (!path.isAbsolute(p)) throw new Error('The folder must be a full path, for example /backups.'); return p; };

// What each type needs. check() returns the cleaned settings or throws a plain-English message.
export const TYPES = {
  folder: { label: 'Folder', secrets: [], check: (s) => ({ path: absPath(s.path) }) },
  smb: { label: 'Windows / NAS share (SMB)', secrets: ['password'], check: (s) => ({ host: need(s.host, 'server name or address'), share: need(s.share, 'share name'), folder: String(s.folder || '').trim(), domain: String(s.domain || '').trim(), username: need(s.username, 'user name') }) },
  s3: { label: 'S3-compatible storage', secrets: ['secretKey'], check: (s) => {
    const endpoint = String(s.endpoint || '').trim(); if (endpoint && !/^https?:\/\/[^\s/]+/i.test(endpoint)) throw new Error('The endpoint must start with https:// (or http:// for a server on your own network).');
    return { endpoint, region: String(s.region || '').trim() || 'us-east-1', bucket: need(s.bucket, 'bucket name'), prefix: String(s.prefix || '').trim().replace(/^\/+|\/+$/g, ''), accessKey: need(s.accessKey, 'access key'), pathStyle: !!s.pathStyle };
  } },
  sftp: { label: 'SFTP (SSH) server', secrets: ['password', 'privateKey', 'keyPassphrase'], check: (s) => {
    const port = Number(s.port || 22); if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('The port must be a number from 1 to 65535.');
    return { host: need(s.host, 'server name or address'), port, username: need(s.username, 'user name'), folder: String(s.folder || '').trim() };
  } },
  webdav: { label: 'WebDAV', secrets: ['password'], check: (s) => { const url = need(s.url, 'WebDAV address'); if (!/^https?:\/\/[^\s/]+/i.test(url)) throw new Error('The WebDAV address must start with https:// (or http://).'); return { url, username: need(s.username, 'user name'), folder: String(s.folder || '').trim() }; } },
};
const LOCAL = () => ({ id: 'local', type: 'folder', name: 'This server', enabled: true, builtin: true, settings: { path: backupDir() }, secrets: {} });

const all = async (db) => (await getSetting(db, 'backup_destinations', []));
const save = (db, list) => setSetting(db, 'backup_destinations', list);
// A fingerprint of everything that decides whether a connection works; a passed test only counts while it is unchanged.
const sig = (d) => crypto.createHash('sha256').update(JSON.stringify([d.type, d.settings, d.secrets || {}])).digest('hex').slice(0, 24);
export const needsEncryption = (d) => !(d.id === 'local' || (d.type === 'folder' && path.resolve(d.settings.path) === path.resolve(defaultBackupDir())));

// What the browser may see: settings, and for every secret only whether it is saved.
export const publicView = (d) => ({ id: d.id, type: d.type, typeLabel: TYPES[d.type].label, name: d.name, enabled: !!d.enabled, builtin: !!d.builtin, settings: d.settings, secrets: Object.fromEntries(TYPES[d.type].secrets.map(k => [k, d.secrets?.[k] ? 'saved' : ''])), hostKey: d.hostKey || '', encrypted: needsEncryption(d), lastTest: d.lastTest || null, tested: d.builtin || !!(d.lastTest?.ok && d.lastTest.sig === sig(d)) });
export async function listDestinations(db) { return [publicView(LOCAL()), ...(await all(db)).map(publicView)]; }
export async function getDestination(db, id) { if (id === 'local') return LOCAL(); const d = (await all(db)).find(x => x.id === id); if (!d) throw new Error('That destination was not found.'); return d; }
export async function enabledDestinations(db, ids) { const list = [LOCAL(), ...(await all(db))]; return (ids || []).map(id => list.find(d => d.id === id)).filter(d => d && d.enabled); }

// body: { type, name, enabled, settings:{…}, secrets:{ password:'…' } } — a blank secret keeps the saved one.
export async function saveDestination(db, body, actor, id = null) {
  const list = await all(db), cur = id ? list.find(d => d.id === id) : null;
  if (id && !cur) throw new Error('That destination was not found.');
  const type = cur ? cur.type : String(body.type || ''); if (!TYPES[type]) throw new Error('Choose a destination type.');
  const name = need(body.name, 'name').slice(0, 60); if (list.some(d => d.id !== id && d.name.toLowerCase() === name.toLowerCase())) throw new Error('Another destination already has that name.');
  const settings = TYPES[type].check(body.settings || {}), secrets = { ...(cur?.secrets || {}) };
  for (const k of TYPES[type].secrets) { const v = body.secrets?.[k]; if (typeof v === 'string' && v && v !== 'saved') secrets[k] = seal(v); else if (v === null) delete secrets[k]; }
  if (type === 'smb' || type === 'webdav') { if (!secrets.password) throw new Error('Enter the password.'); }
  if (type === 's3' && !secrets.secretKey) throw new Error('Enter the secret key.');
  if (type === 'sftp' && !secrets.password && !secrets.privateKey) throw new Error('Enter a password or paste a private key.');
  const d = { id: cur?.id || crypto.randomBytes(6).toString('hex'), type, name, enabled: !!body.enabled, settings, secrets, hostKey: cur?.hostKey || '', lastTest: cur?.lastTest || null };
  if (type === 'sftp' && cur && (cur.settings.host !== settings.host || cur.settings.port !== settings.port)) d.hostKey = ''; // a different server has a different identity
  if (d.enabled && needsEncryption(d) && !(await getPassphrase(db))) throw new Error('Set the backup passphrase (Full-site backups tab) before turning on a destination. Everything sent away from this server is encrypted with it.');
  if (d.enabled && needsEncryption(d)) {
    await assertPassphraseReady(db);
    if (!(d.lastTest?.ok && d.lastTest.sig === sig(d))) throw coded('HOST_BACKUP_DEST_TEST_FIRST'); // Test connection must pass first, on exactly these details
  }
  if (cur) list[list.indexOf(cur)] = d; else list.push(d);
  await save(db, list);
  L.info('destination.saved', `Backup destination "${name}" (${type}) ${cur ? 'changed' : 'added'}, ${d.enabled ? 'on' : 'off'}`, { actor, data: { id: d.id, type, name, enabled: d.enabled } });
  return publicView(d);
}
export async function deleteDestination(db, id, actor) {
  const list = await all(db), d = list.find(x => x.id === id); if (!d) throw new Error('That destination was not found.');
  await save(db, list.filter(x => x.id !== id));
  const t = await getSetting(db, 'backup_tiers', null); if (t?.offsite?.destinations) { t.offsite.destinations = t.offsite.destinations.filter(x => x !== id); await setSetting(db, 'backup_tiers', t); }
  const f = await getSetting(db, 'backup_full', null); if (f?.destinationIds) { f.destinationIds = f.destinationIds.filter(x => x !== id); await setSetting(db, 'backup_full', f); }
  L.info('destination.deleted', `Backup destination "${d.name}" removed (files already sent there were left in place)`, { actor, data: { id, name: d.name } });
  return d;
}

export function clientFor(d, { learn = false, onFingerprint } = {}) {
  const sec = {}; for (const k of TYPES[d.type].secrets) { if (d.secrets?.[k]) { try { sec[k] = unseal(d.secrets[k]); } catch { throw new Error('The saved password could not be read (was the server\'s encryption key changed?). Enter it again.'); } } }
  const s = d.settings;
  if (d.type === 'folder') return folderClient(s);
  if (d.type === 'smb') return smbClient(s, sec, hooks.smbRunner ? { runner: hooks.smbRunner } : {});
  if (d.type === 's3') return s3Client(s, sec, hooks.now ? { now: hooks.now } : {});
  if (d.type === 'sftp') return sftpClient(s, sec, { pinned: d.hostKey, learn, ssh2: hooks.ssh2, onFingerprint });
  return webdavClient(s, sec);
}
export async function getClient(db, id) { return clientFor(await getDestination(db, id)); }

// Writes a small file, reads it back and deletes it. Never throws; the answer is plain English.
export async function testDestination(db, id, actor) {
  const d = await getDestination(db, id); let learned = '';
  const name = `.mbs-connection-test-${crypto.randomBytes(4).toString('hex')}.txt`, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-dtest-')), file = path.join(dir, 'test.txt');
  try {
    fs.writeFileSync(file, `myBoxStock connection test ${new Date().toISOString()}\n`);
    const c = clientFor(d, { learn: d.type === 'sftp' && !d.hostKey, onFingerprint: (fp) => { learned = fp; } });
    const r = await c.put(file, name), st = await c.stat(name);
    if (!st || (r.size != null && st.size !== fs.statSync(file).size)) throw new Error('The test file was written but could not be read back correctly.');
    await c.remove(name); if (await c.stat(name)) throw new Error('The test file could not be removed again.');
    if (id !== 'local') { const list = await all(db), x = list.find(y => y.id === id); if (x) { if (learned) x.hostKey = learned; x.lastTest = { at: Date.now(), ok: true, sig: sig(x) }; await save(db, list); } }
    L.info('destination.test_ok', `Test connection to "${d.name}" worked`, { actor, data: { id, type: d.type } });
    return { ok: true, message: `Connected. A small test file was written, read back and removed.${learned ? ` The server's identity (${learned}) was recorded and will be required from now on.` : ''}`, fingerprint: learned || d.hostKey || '' };
  } catch (e) {
    const list = await all(db), x = list.find(y => y.id === id); if (x) { x.lastTest = { at: Date.now(), ok: false }; await save(db, list); }
    L.warn('destination.test_failed', `Test connection to "${d.name}" failed: ${e.message}`, { actor, data: { id, type: d.type } });
    return { ok: false, message: e.message };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Sends one local file to a destination. Anything leaving the default folder is encrypted first (full-site bundles already are).
// Returns { name, size, encrypted, hashChecked }. Throws if the stored copy cannot be confirmed.
export async function uploadVerified(db, d, localFile, remoteName, { passphrase } = {}) {
  const c = clientFor(d); let src = localFile, name = remoteName, tmpDir = null, encrypted = isEncryptedName(remoteName);
  try {
    if (needsEncryption(d) && !encrypted) {
      const pass = passphrase || await getPassphrase(db); if (!pass) throw new Error('No backup passphrase is set, so nothing can be sent away from this server.');
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-enc-')); src = path.join(tmpDir, remoteName + ENC_EXT); name = remoteName + ENC_EXT;
      await encryptFile(localFile, src, pass); encrypted = true;
    }
    const want = fs.statSync(src).size, r = await c.put(src, name), st = await c.stat(name);
    if (!st || st.size !== want) throw new Error(`The copy at "${d.name}" is not the same size as the original (${st ? st.size : 'missing'} instead of ${want}).`);
    return { name, size: want, encrypted, hashChecked: !!r.hashChecked };
  } finally { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); }
}
