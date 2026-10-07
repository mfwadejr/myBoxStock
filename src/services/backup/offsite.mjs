// SERVICES / backup / offsite — test a copy held at a destination, and restore from it only after it has passed.
// Test: fetch the copy, check it is complete (size, checksum, authenticated decryption), open it in a scratch copy, run the database integrity check,
// check the migrations and app version fit this server, count what is inside and compare with the live site. Then the scratch copy is deleted.
// The live database is only ever counted, never changed. A passing test gives a one-time token tied to that exact file; the restore needs it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../../core/config.mjs';
import { LATEST_MIGRATION } from '../../db/schema.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { getDestination, clientFor } from './destinations/index.mjs';
import { decryptFile } from './crypt.mjs';
import { extractBundle, keyOf, stageExtracted } from './bundle.mjs';
import { checkSqliteFile } from './testrestore.mjs';
import { getPassphrase, earlierPassphraseNote } from './passphrase.mjs';
import { createBackup } from './create.mjs';
import { stageRestoreFile } from './restore.mjs';
import { takenAtFromName } from './files.mjs';
import { coded, updateSetupRecord } from './gate.mjs';
import { audit } from './audit.mjs';
import { jobStep, jobBytes } from './progress.mjs';

const L = areaLogger('backup');
const ok = (label, detail = '') => ({ ok: true, label, detail }), bad = (label, detail = '') => ({ ok: false, label, detail });
const NAME = /^myboxstock-[\w.-]+\.(db|db\.mbsenc|mbsbak|sql|sql\.mbsenc)$/;
export const TOKEN_MS = 30 * 60e3;
const tokens = new Map();
const sweep = () => { const now = Date.now(); for (const [k, v] of tokens) if (v.exp < now) tokens.delete(k); };
export const dropToken = (t) => tokens.delete(t);
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
export const sha = (f) => new Promise((res, rej) => { const h = crypto.createHash('sha256'), total = fs.statSync(f).size; let n = 0; fs.createReadStream(f).on('data', (c) => { h.update(c); n += c.length; jobBytes(n, total); }).on('end', () => res(h.digest('hex'))).on('error', rej); });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// What the copy holds, read from a private SQLite file: counts, account ids, newest change (records or accounts) and the database version.
export function inspect(file) {
  const d = new DatabaseSync(file, { readOnly: true });
  try {
    const one = (sql) => { try { return Object.values(d.prepare(sql).get() || {})[0]; } catch { return null; } };
    let ids = []; try { ids = d.prepare('SELECT id FROM accounts').all().map(r => String(r.id)); } catch {}
    return { accounts: ids.length, users: Number(one('SELECT COUNT(*) FROM account_users') ?? 0), records: Number(one('SELECT COUNT(*) FROM records') ?? 0), newest: Math.max(Number(one('SELECT MAX(updated_at) FROM records') || 0), Number(one('SELECT MAX(created_at) FROM accounts') || 0)), migration: Number(one('SELECT MAX(id) FROM schema_migrations') || 0), ids };
  } finally { d.close(); }
}
export async function liveFacts(db) {
  const n = async (sql) => Number((await db.get(sql))?.n ?? 0);
  return { accounts: await n('SELECT COUNT(*) AS n FROM accounts'), users: await n('SELECT COUNT(*) AS n FROM account_users'), records: await n('SELECT COUNT(*) AS n FROM records'), newest: Math.max(await n('SELECT MAX(updated_at) AS n FROM records'), await n('SELECT MAX(created_at) AS n FROM accounts')), ids: (await db.all('SELECT id FROM accounts')).map(r => String(r.id)) };
}
export function compareText(copy, live, takenAt) {
  const onlyCopy = copy.ids.filter(i => !live.ids.includes(i)).length, onlyLive = live.ids.filter(i => !copy.ids.includes(i)).length;
  const when = copy.newest || takenAt, relation = when < live.newest ? 'older' : when > live.newest ? 'newer' : 'same';
  const line = `The copy holds ${plural(copy.accounts, 'account')}, ${plural(copy.users, 'user')} and ${plural(copy.records, 'record')}; the live site holds ${plural(live.accounts, 'account')}, ${plural(live.users, 'user')} and ${plural(live.records, 'record')}. `
    + (relation === 'older' ? 'The copy is older than the live site, so recent entries would be lost. ' : relation === 'newer' ? 'The copy is newer than the live site. ' : 'The copy matches the live site’s latest change. ')
    + (onlyCopy + onlyLive ? `${plural(onlyCopy + onlyLive, 'account')} differ (${onlyLive} only on the live site, ${onlyCopy} only in the copy).` : 'The same accounts are in both.');
  return { relation, accountsOnlyInCopy: onlyCopy, accountsOnlyLive: onlyLive, copy: { accounts: copy.accounts, users: copy.users, records: copy.records }, live: { accounts: live.accounts, users: live.users, records: live.records }, line };
}

// Does a file made by another version of the app fit this server? (Refuses one made by a newer app or database.)
export function fitCheck(facts, manifest) {
  const newerDb = facts.migration > LATEST_MIGRATION, newerApp = manifest?.version && cmpVer(manifest.version, config.version) > 0;
  return newerDb || newerApp ? bad('It fits this version of the app', `This copy comes from a newer version of myBoxStock (${newerApp ? 'app ' + manifest.version : 'database version ' + facts.migration}); this server runs ${config.version} (database version ${LATEST_MIGRATION}). Update this server first.`)
    : ok('It fits this version of the app', facts.migration < LATEST_MIGRATION ? `Made by an older version (database version ${facts.migration}); it is brought up to date when the site restarts.` : `Database version ${facts.migration}, the same as this server.`);
}

// Fetches the copy into `dir` and checks it is whole. Returns { file, size, sha, stat } or pushes a failed check and returns null.
async function fetchCopy(db, destId, name, dir, checks) {
  let d, c;
  try { d = await getDestination(db, destId); c = clientFor(d); } catch (e) { checks.push(bad('The destination can be reached', e.message)); return null; }
  let stat;
  try { stat = await c.stat(name); } catch (e) { checks.push(bad('The destination can be reached', `Could not reach "${d.name}": ${e.message}`)); return null; }
  checks.push(ok('The destination can be reached', d.name));
  if (!stat) { checks.push(bad('The copy is still there', `"${d.name}" has no file called ${name}. It may have been removed or thinned out.`)); return null; }
  const file = path.join(dir, name);
  jobStep('Fetching the copy from the destination', 2, 30);
  try { await c.get(name, file); } catch (e) { checks.push(bad('The copy can be fetched', `Could not fetch it from "${d.name}": ${e.message}`)); return null; }
  const size = fs.statSync(file).size;
  if (stat.size != null && size !== stat.size) { checks.push(bad('The file is complete (size and checksum)', `The destination lists ${stat.size} bytes but ${size} arrived. The copy is cut short or damaged.`)); return null; }
  jobStep('Verifying the copy', 30, 45);
  const hash = await sha(file);
  checks.push(ok('The copy can be fetched', `${size} bytes, SHA-256 ${hash.slice(0, 16)}…`));
  return { file, size, sha: hash, stat, dest: d };
}

// Turns the fetched file into a plain SQLite file at `out`. Returns { manifest } or null (with a failed check).
export async function openCopy(db, file, name, out, pass, checks) {
  jobStep(name.endsWith('.db') ? 'Copying the file' : 'Decrypting the file and checking every part', 45, 85);
  if (/\.sql(\.mbsenc)?$/.test(name)) { checks.push(bad('The copy is a SQLite database', 'This copy is a PostgreSQL or MariaDB dump. Restoring from the console works on SQLite only.')); return null; }
  try {
    if (name.endsWith('.mbsenc')) {
      if (!pass) { checks.push(bad('The backup passphrase opens the copy', 'No backup passphrase is saved on this server. Type the passphrase and test again.')); return null; }
      await decryptFile(file, out, pass); checks.push(ok('The backup passphrase opens the copy', 'It decrypted, and every part passed its authenticity check, so the file is complete and unchanged.')); return { manifest: null };
    }
    if (name.endsWith('.mbsbak')) {
      if (!pass) { checks.push(bad('The backup passphrase opens the copy', 'No backup passphrase is saved on this server. Type the passphrase and test again.')); return null; }
      const x = await extractBundle(file, pass, { dir: path.dirname(out) }), m = x.manifest;
      checks.push(ok('The backup passphrase opens the copy', 'It decrypted, and the whole file passed its authenticity check, so it is complete and unchanged.'));
      if (m.engine !== 'sqlite') { x.cleanup(); checks.push(bad('The copy is a SQLite database', 'This full-site backup holds a PostgreSQL or MariaDB dump. Restoring from the console works on SQLite only.')); return null; }
      checks.push(keyOf(x) ? ok('The encryption key is inside') : bad('The encryption key is inside', 'The backup has no key, so two-factor secrets could not be read after a restore.'));
      fs.renameSync(x.files['database.db'], out); x.files['database.db'] = out; return { manifest: m, bundle: x };
    }
    fs.copyFileSync(file, out); checks.push(ok('The copy is an unencrypted database file', 'It was stored at a destination without encryption, so there is no passphrase to check.')); return { manifest: null };
  } catch (e) {
    checks.push(bad('The backup passphrase opens the copy', /Wrong passphrase/i.test(e.message) ? (await earlierPassphraseNote(db, takenAtFromName(name, 0))) || 'The backup passphrase does not open this copy, or the copy is damaged. If the passphrase was changed after this copy was made, type the old passphrase and test again.' : e.message)); return null;
  }
}

// Runs every check. Never changes the live site. Returns { ok, checks, compare, counts, summary, token?, name, destination }.
export async function testOffsiteCopy(db, destId, name, { passphrase = '', actor = null } = {}) {
  if (!NAME.test(name) || name.includes('..')) throw coded('HOST_BACKUP_COPY_NOT_FOUND');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-offtest-')), checks = []; let compare = null, counts = null, fetched = null, pass = passphrase;
  try {
    if (db.client !== 'sqlite') checks.push(bad('This server uses SQLite', 'Restoring from the console works on SQLite only. On PostgreSQL or MariaDB, load the dump with psql or mysql.'));
    else {
      fetched = await fetchCopy(db, destId, name, dir, checks);
      if (fetched) {
        if (!pass && !/\.db$/.test(name)) pass = await getPassphrase(db);
        const scratch = path.join(dir, 'scratch.db'), opened = await openCopy(db, fetched.file, name, scratch, pass, checks);
        if (opened) {
          jobStep('Checking the database', 85, 95); const r = checkSqliteFile(scratch); checks.push(...r.checks.map(c => c.label === 'The database passes its integrity check' ? { ...c, label: 'The database passes its integrity check (opened in a scratch copy)' } : c));
          if (r.counts) {
            jobStep('Comparing with the live site', 95, 99); const facts = inspect(scratch);
            checks.push(fitCheck(facts, opened.manifest));
            counts = { accounts: facts.accounts, users: facts.users, records: facts.records };
            compare = compareText(facts, await liveFacts(db), takenAtFromName(name, fetched.stat.mtime || 0));
            checks.push(ok('What is inside, compared with the live site', compare.line));
          }
        }
      }
    }
  } catch (e) { checks.push(bad('The copy could be checked', e.message)); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  if (!fs.existsSync(dir)) checks.push(ok('The scratch copy was deleted', 'The live site was not touched.'));
  const pass_ = checks.every(c => c.ok), failed = checks.find(c => !c.ok);
  let token = null;
  if (pass_ && fetched) {
    sweep(); for (const [k, v] of tokens) if (v.actor === actor && v.name === name && v.dest === destId) tokens.delete(k);
    token = crypto.randomBytes(24).toString('hex'); tokens.set(token, { actor, dest: destId, name, size: fetched.size, sha: fetched.sha, exp: Date.now() + TOKEN_MS });
  }
  const summary = pass_ ? 'This copy passed every check. It opens, its data is intact and it would restore. The live site was not touched.' : `This copy did not pass. ${failed?.detail || failed?.label || 'It could not be checked.'} It cannot be restored.`;
  (pass_ ? L.info : L.warn).call(L, 'offsite.test', `Test restore of offsite copy ${name}: ${pass_ ? 'passed' : 'FAILED'}`, { actor, data: { name, destination: destId, pass: pass_, counts } });
  if (pass_ && fetched) { try { await updateSetupRecord(db, { offsiteVerified: { at: Date.now(), name } }); } catch {} }
  return { ok: pass_, name, destination: destId, checks, counts, compare, summary, token, expiresInMs: token ? TOKEN_MS : 0 };
}
export const testLatestOffsite = (db, destId, name, o = {}) => testOffsiteCopy(db, destId, name, o);

// Restores a copy that passed testOffsiteCopy in this sheet session. Safety copy first, then the restore is staged for the next start.
export async function restoreOffsiteCopy(db, destId, name, { token, passphrase = '', actor = null, ip = null } = {}) {
  if (db.client !== 'sqlite') throw coded('HOST_BACKUP_SQLITE_ONLY');
  sweep(); const t = tokens.get(String(token || ''));
  if (!t || t.actor !== actor || t.dest !== destId || t.name !== name) throw coded('HOST_BACKUP_COPY_NOT_TESTED');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-offrestore-')), checks = [];
  try {
    const f = await fetchCopy(db, destId, name, dir, checks);
    if (!f) throw coded('HOST_BACKUP_COPY_NOT_FOUND');
    if (f.size !== t.size || f.sha !== t.sha) throw coded('HOST_BACKUP_COPY_CHANGED');
    const pass = passphrase || (/\.db$/.test(name) ? '' : await getPassphrase(db)), scratch = path.join(dir, 'restore.db');
    const opened = await openCopy(db, f.file, name, scratch, pass, checks); if (!opened) throw new Error(checks.find(c => !c.ok)?.detail || 'The copy could not be opened.');
    jobStep('Taking a safety copy of the live site', 85, 95); const safety = await createBackup(db, 'pre-restore', actor); jobStep('Staging the restore', 95, 99);
    const takenAt = opened.manifest ? Date.parse(opened.manifest.createdAt) || takenAtFromName(name, f.stat.mtime || Date.now()) : takenAtFromName(name, f.stat.mtime || Date.now());
    if (opened.bundle) stageExtracted(opened.bundle, { name, actor, takenAt }); else stageRestoreFile(scratch, { name, takenAt, actor });
    tokens.delete(token);
    audit('backup.restore', `Restore from the offsite copy ${name} at "${f.dest.name}" requested (safety copy ${safety}); restarting`, { actor, ip, level: 'warn', data: { name, destination: f.dest.name, safetyCopy: safety, source: 'offsite' } });
    return { ok: true, safetyCopy: safety, takenAt };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
