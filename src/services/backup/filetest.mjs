// SERVICES / backup / filetest — the Host's "Test a backup file": a backup held somewhere else (a full-site .mbsbak on a laptop, a copy used to rebuild
// after losing the server) is uploaded as a stream to a private holding folder, or picked from the server's backup folder, and opened in a scratch copy.
// The report says what is inside (accounts by plan and status, users by role, records per account by type) and how it compares with the live site.
// The Host cannot open reseller records: the server holds only each record's type in the clear, so only counts are shown, never contents.
// A passing test gives a one-time token tied to that exact file; "Restore this file" needs it and follows the same safeguards as the offsite restore.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../../core/config.mjs';
import { LATEST_MIGRATION } from '../../db/schema.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { backupDir, takenAtFromName } from './files.mjs';
import { checkSqliteFile } from './testrestore.mjs';
import { openCopy, fitCheck, sha } from './offsite.mjs';
import { getPassphrase } from './passphrase.mjs';
import { createBackup } from './create.mjs';
import { stageExtracted } from './bundle.mjs';
import { stageRestoreFile } from './restore.mjs';
import { coded } from './gate.mjs';
import { audit } from './audit.mjs';
import { jobStep } from './progress.mjs';

const L = areaLogger('backup');
const ok = (label, detail = '') => ({ ok: true, label, detail }), bad = (label, detail = '') => ({ ok: false, label, detail });
export const FILE_TYPES = /\.(mbsbak|mbsenc|db)$/;
const NAME = /^[\w.-]{1,150}$/;
export const TOKEN_MS = 30 * 60e3, HOLD_MS = 60 * 60e3, LISTED_MAX = 200;
export const NOTE = 'The Host cannot open reseller records. The server holds only encrypted blobs and each blob’s type, so this report counts them but cannot read them. Only a reseller’s own Test a backup file proves that their data decrypts.';
export const uploadLimit = () => Number(process.env.BACKUP_UPLOAD_MAX_BYTES) || config.backupUploadMaxBytes;
const holdDir = () => path.join(config.dataDir, 'backup-incoming');
const held = new Map(), tokens = new Map();

// Files left in the holding folder by an earlier run are removed at start-up.
export function cleanIncoming() { held.clear(); try { fs.rmSync(holdDir(), { recursive: true, force: true }); } catch {} }
function sweep() {
  const now = Date.now();
  for (const [k, v] of tokens) if (v.exp < now) tokens.delete(k);
  for (const [k, v] of held) if (v.exp < now) { fs.rmSync(v.file, { force: true }); held.delete(k); }
}
export const dropToken = (t) => tokens.delete(t);
export const discardUpload = (id, actor) => {
  const h = held.get(id); if (!h || h.actor !== actor) return false;
  fs.rmSync(h.file, { force: true }); held.delete(id); for (const [k, v] of tokens) if (v.upload === id) tokens.delete(k); return true;
};

// Files in the server's backup folder that the test understands (placed there by hand, or copied in from elsewhere).
export function folderFiles() {
  const dir = backupDir(); let out = [];
  try { out = fs.readdirSync(dir).filter(f => FILE_TYPES.test(f) && NAME.test(f)).map(f => { const st = fs.statSync(path.join(dir, f)); return { name: f, size: st.size, mtime: st.mtimeMs, takenAt: takenAtFromName(f, st.mtimeMs) }; }).filter(f => f.size > 0); } catch {}
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Streams an upload to disk, counting bytes, never holding it in memory. Resolves { id, name, size }.
export async function receiveUpload(req, { name, actor, ip }) {
  sweep();
  if (!NAME.test(name) || name.includes('..') || !FILE_TYPES.test(name)) throw coded('HOST_BACKUP_FILE_KIND');
  const limit = uploadLimit(), declared = Number(req.headers['content-length'] || 0);
  if (declared > limit) throw coded('HOST_BACKUP_UPLOAD_TOO_BIG');
  fs.mkdirSync(holdDir(), { recursive: true, mode: 0o700 });
  let free = Infinity; try { const s = fs.statfsSync(holdDir()); free = Number(s.bavail) * Number(s.bsize); } catch {}
  if (declared * 2 > free) throw coded('HOST_BACKUP_UPLOAD_NO_SPACE'); // the scratch copy needs room too
  const id = crypto.randomBytes(12).toString('hex'), file = path.join(holdDir(), id + '.upload'), out = fs.createWriteStream(file, { mode: 0o600 });
  let size = 0;
  try {
    await new Promise((res, rej) => {
      const onData = (c) => { size += c.length; if (size > limit) { req.off('data', onData); req.unpipe(out); req.pause(); out.destroy(); rej(coded('HOST_BACKUP_UPLOAD_TOO_BIG')); } };
      req.on('data', onData);
      req.on('close', () => { if (!req.complete) rej(new Error('The upload was cut off before it finished.')); }); req.on('error', rej); out.on('error', rej);
      out.on('finish', res); req.pipe(out);
    });
  } catch (e) { out.destroy(); fs.rmSync(file, { force: true }); throw e; }
  if (!size) { fs.rmSync(file, { force: true }); throw coded('HOST_BACKUP_UPLOAD_EMPTY'); }
  held.set(id, { file, name, size, actor, exp: Date.now() + HOLD_MS });
  audit('backup.file_upload', `Backup file ${name} uploaded for testing (${size} bytes)`, { actor, ip, data: { name, size } });
  return { id, name, size };
}

const resolveSource = (source, actor) => {
  sweep();
  if (source?.upload) {
    const h = held.get(String(source.upload)); if (!h || h.actor !== actor) throw coded('HOST_BACKUP_UPLOAD_GONE');
    return { key: 'u:' + source.upload, upload: String(source.upload), file: h.file, name: h.name, from: 'upload' };
  }
  const name = String(source?.folder || ''); if (!NAME.test(name) || name.includes('..') || !FILE_TYPES.test(name)) throw coded('HOST_BACKUP_FILE_KIND');
  const file = path.join(backupDir(), name); if (!fs.existsSync(file)) throw coded('HOST_BACKUP_COPY_NOT_FOUND');
  return { key: 'f:' + name, file, name, from: 'folder' };
};

const TYPE_KEY = { item: 'devices', customer: 'customers', sale: 'sales' };
const zero = () => ({ devices: 0, customers: 0, sales: 0, other: 0 });
const tally = (rows) => { const m = new Map(); for (const r of rows) { const o = m.get(String(r.account_id)) || zero(); o[TYPE_KEY[r.type] || 'other'] += Number(r.n); m.set(String(r.account_id), o); } return m; };
// Kinds of record beyond devices, customers and sales: model reorder levels and the account's settings (which hold delivery, label and return settings). Counts only.
const KIND_KEY = { model: 'models', config: 'settings' };
const kindTally = (rows) => { const o = { models: 0, settings: 0, other: 0 }; for (const r of rows) { if (TYPE_KEY[r.type]) continue; o[KIND_KEY[r.type] || 'other'] += Number(r.n); } return o; };
const group = (rows, key) => { const o = {}; for (const r of rows) o[r[key] || 'none'] = (o[r[key] || 'none'] || 0) + 1; return o; };

// Everything the Host may see about a database, from a private SQLite file.
function readFile(file) {
  const d = new DatabaseSync(file, { readOnly: true });
  try {
    const all = (sql) => { try { return d.prepare(sql).all(); } catch { return []; } };
    const accounts = all('SELECT id, account_code, plan, status, created_at FROM accounts'), demo = Number(all('SELECT COUNT(*) AS n FROM accounts WHERE demo = 1')[0]?.n || 0); // older files have no demo column: 0
    return { demo, accounts, users: all('SELECT account_id, role FROM account_users'), rec: all('SELECT account_id, type, COUNT(*) AS n FROM records GROUP BY account_id, type'), newest: Math.max(Number(Object.values(all('SELECT MAX(updated_at) AS n FROM records')[0] || {})[0] || 0), ...accounts.map(a => Number(a.created_at) || 0)), migration: Number(Object.values(all('SELECT MAX(id) AS n FROM schema_migrations')[0] || {})[0] || 0) };
  } finally { d.close(); }
}
async function readLive(db) {
  const accounts = await db.all('SELECT id, account_code, plan, status, created_at FROM accounts'), users = await db.all('SELECT account_id, role FROM account_users'), rec = await db.all('SELECT account_id, type, COUNT(*) AS n FROM records GROUP BY account_id, type');
  const n = async (sql) => Number((await db.get(sql))?.n ?? 0);
  return { accounts, users, rec, newest: Math.max(await n('SELECT MAX(updated_at) AS n FROM records'), ...accounts.map(a => Number(a.created_at) || 0)) };
}

// The report: file against live. Counts only; nothing is decrypted.
export function buildReport(fileData, liveData, { takenAt }) {
  const fRec = tally(fileData.rec), lRec = tally(liveData.rec), fUsers = new Map(), roles = {};
  for (const u of fileData.users) { fUsers.set(String(u.account_id), (fUsers.get(String(u.account_id)) || 0) + 1); roles[u.role || 'none'] = (roles[u.role || 'none'] || 0) + 1; }
  const live = new Map(liveData.accounts.map(a => [String(a.id), a])), inFile = new Map(fileData.accounts.map(a => [String(a.id), a]));
  const sumRec = (m) => { const t = zero(); for (const o of m.values()) for (const k of Object.keys(t)) t[k] += o[k]; return t; };
  const rows = [], differ = [], onlyFile = [];
  for (const a of fileData.accounts) {
    const id = String(a.id), r = fRec.get(id) || zero(), l = lRec.get(id) || zero(), inLive = live.has(id);
    const state = !inLive ? 'only-file' : ['devices', 'customers', 'sales'].some(k => r[k] !== l[k]) ? 'differs' : 'same'; // devices, customers and sales; settings records are not compared
    rows.push([a.account_code, a.plan || 'none', a.status, fUsers.get(id) || 0, r.devices, r.customers, r.sales, state]);
    if (state === 'only-file') onlyFile.push(a.account_code);
    if (state === 'differs') differ.push({ code: a.account_code, file: r, live: l });
  }
  rows.sort((x, y) => String(x[0]).localeCompare(String(y[0])));
  const onlyLive = liveData.accounts.filter(a => !inFile.has(String(a.id))).map(a => ({ code: a.account_code, plan: a.plan || 'none', status: a.status, ...(lRec.get(String(a.id)) || zero()) })).sort((x, y) => String(x.code).localeCompare(String(y.code)));
  const fileNewest = fileData.newest || takenAt || 0, relation = fileNewest < liveData.newest ? 'older' : fileNewest > liveData.newest ? 'newer' : 'same';
  return {
    accounts: { total: fileData.accounts.length, byPlan: group(fileData.accounts, 'plan'), byStatus: group(fileData.accounts, 'status') },
    users: { total: fileData.users.length, byRole: roles },
    records: { file: sumRec(fRec), live: sumRec(lRec) },
    kinds: { file: kindTally(fileData.rec), live: kindTally(liveData.rec) },
    demo: { inFile: fileData.demo || 0 },
    live: { accounts: liveData.accounts.length, users: liveData.users.length },
    compare: { relation, fileNewest, liveNewest: liveData.newest, onlyLiveTotal: onlyLive.length, onlyLive: onlyLive.slice(0, LISTED_MAX), onlyFileTotal: onlyFile.length, onlyFile: onlyFile.slice(0, LISTED_MAX), differTotal: differ.length, differ: differ.slice(0, LISTED_MAX) },
    rows,
  };
}
export const compareLine = (r, live) => {
  const c = r.compare, p = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return `The file holds ${p(r.accounts.total, 'account')} and ${p(r.users.total, 'user')}; the live site holds ${p(live.accounts, 'account')} and ${p(live.users, 'user')}. `
    + (c.relation === 'older' ? 'The file is older than the latest activity on the live site, so a restore would lose recent entries. ' : c.relation === 'newer' ? 'The file is newer than the live site. ' : 'The file matches the live site’s latest change. ')
    + (c.onlyLiveTotal ? `${p(c.onlyLiveTotal, 'account')} exist only on the live site and would be lost by a restore. ` : '') + (c.onlyFileTotal ? `${p(c.onlyFileTotal, 'account')} exist only in the file. ` : '') + (c.differTotal ? `${p(c.differTotal, 'account')} have different record counts.` : '');
};

// Opens the chosen file in a scratch copy, runs every check and builds the report. Never changes the live site.
export async function testBackupFile(db, source, { passphrase = '', actor = null, ip = null } = {}) {
  const src = resolveSource(source, actor), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-filetest-')), checks = [];
  let report = null, details = null, hash = null, size = 0;
  try {
    const st = fs.statSync(src.file); size = st.size;
    if (db.client !== 'sqlite') checks.push(bad('This server uses SQLite', 'Restoring from the console works on SQLite only. On PostgreSQL or MariaDB, load the dump with psql or mysql.'));
    else {
      jobStep('Reading the file', 2, 25); hash = await sha(src.file);
      checks.push(ok('The file was read', `${size} bytes, SHA-256 ${hash.slice(0, 16)}…`));
      let pass = passphrase; if (!pass && !/\.db$/.test(src.name)) pass = await getPassphrase(db);
      const scratch = path.join(dir, 'scratch.db'), opened = await openCopy(db, src.file, src.name, scratch, pass, checks);
      if (opened) {
        jobStep('Checking the database', 85, 95); const r = checkSqliteFile(scratch); checks.push(...r.checks.map(c => c.label === 'The database passes its integrity check' ? { ...c, label: 'The database passes its integrity check (opened in a scratch copy)' } : c));
        if (r.counts) {
          jobStep('Comparing with the live site', 95, 99); const f = readFile(scratch), takenAt = opened.manifest ? Date.parse(opened.manifest.createdAt) || takenAtFromName(src.name, st.mtimeMs) : takenAtFromName(src.name, st.mtimeMs);
          checks.push(fitCheck({ migration: f.migration }, opened.manifest));
          const live = await readLive(db);
          report = buildReport(f, live, { takenAt });
          details = { name: src.name, from: src.from, size, sha256: hash, takenAt, appVersion: opened.manifest?.version || null, migration: f.migration, serverMigration: LATEST_MIGRATION, serverVersion: config.version, engine: opened.manifest?.engine || 'sqlite',
            format: opened.manifest?.format || null, demoLeftOut: Number(opened.manifest?.demoAccountsLeftOut) || 0, kind: /\.mbsbak$/.test(src.name) ? 'Full-site backup' : /\.mbsenc$/.test(src.name) ? 'Encrypted copy of a snapshot' : 'Database snapshot' };
          checks.push(ok('What is inside, compared with the live site', compareLine(report, { accounts: live.accounts.length, users: live.users.length })));
        }
        opened.bundle?.cleanup?.();
      }
    }
  } catch (e) { checks.push(bad('The file could be checked', e.message)); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  if (!fs.existsSync(dir)) checks.push(ok('The scratch copy was deleted', 'The live site was not touched.'));
  const pass_ = checks.every(c => c.ok) && !!report, failed = checks.find(c => !c.ok);
  details && (details.readable = checks.find(c => c.label === 'It fits this version of the app')?.ok === true);
  sweep(); let token = null;
  if (pass_) {
    for (const [k, v] of tokens) if (v.actor === actor && v.key === src.key) tokens.delete(k);
    token = crypto.randomBytes(24).toString('hex'); tokens.set(token, { actor, key: src.key, upload: src.upload || null, source: src.upload ? { upload: src.upload } : { folder: src.name }, name: src.name, size, sha: hash, exp: Date.now() + TOKEN_MS });
  }
  const summary = pass_ ? 'This file passed every check. It opens, its data is intact and it would restore. The live site was not touched.' : `This file did not pass. ${failed?.detail || failed?.label || 'It could not be checked.'} It cannot be restored.`;
  audit('backup.file_test', `Test of backup file ${src.name} (${src.from}): ${pass_ ? 'passed' : 'FAILED'}`, { actor, ip, level: pass_ ? 'info' : 'warn', data: { name: src.name, from: src.from, size, ok: pass_, accounts: report?.accounts.total ?? null } });
  (pass_ ? L.info : L.warn).call(L, 'file_test', `Test of backup file ${src.name}: ${pass_ ? 'passed' : 'FAILED'}`, { actor, data: { name: src.name, pass: pass_ } });
  return { ok: pass_, name: src.name, checks, details, report, note: NOTE, summary, token, expiresInMs: token ? TOKEN_MS : 0 };
}

// Restores a file that passed testBackupFile in this sheet session. The file is opened again and must still be the exact file that was tested.
// Safety copy first, then the restore is staged for the next start.
export async function restoreBackupFile(db, { token, passphrase = '', actor = null, ip = null } = {}) {
  if (db.client !== 'sqlite') throw coded('HOST_BACKUP_SQLITE_ONLY');
  sweep(); const t = tokens.get(String(token || ''));
  if (!t || t.actor !== actor) throw coded('HOST_BACKUP_COPY_NOT_TESTED');
  const src = resolveSource(t.source, actor), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-filerestore-')), checks = [];
  try {
    jobStep('Reading the file', 2, 25);
    if (fs.statSync(src.file).size !== t.size || await sha(src.file) !== t.sha) throw coded('HOST_BACKUP_COPY_CHANGED');
    const pass = passphrase || (/\.db$/.test(src.name) ? '' : await getPassphrase(db)), scratch = path.join(dir, 'restore.db');
    const opened = await openCopy(db, src.file, src.name, scratch, pass, checks); if (!opened) throw new Error(checks.find(c => !c.ok)?.detail || 'The file could not be opened.');
    jobStep('Taking a safety copy of the live site', 85, 95); const safety = await createBackup(db, 'pre-restore', actor), stat = fs.statSync(src.file); jobStep('Staging the restore', 95, 99);
    const takenAt = opened.manifest ? Date.parse(opened.manifest.createdAt) || takenAtFromName(src.name, stat.mtimeMs) : takenAtFromName(src.name, stat.mtimeMs);
    if (opened.bundle) stageExtracted(opened.bundle, { name: src.name, actor, takenAt }); else stageRestoreFile(scratch, { name: src.name, takenAt, actor });
    tokens.delete(token); if (src.upload) discardUpload(src.upload, actor);
    audit('backup.restore', `Restore from the backup file ${src.name} (${src.from}) requested (safety copy ${safety}); restarting`, { actor, ip, level: 'warn', data: { name: src.name, safetyCopy: safety, source: 'file', from: src.from } });
    return { ok: true, safetyCopy: safety, takenAt };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
