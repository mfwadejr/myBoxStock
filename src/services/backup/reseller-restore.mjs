// SERVICES / backup / reseller-restore — restore ONE reseller's data from a backup the Host already holds, without touching anyone else.
// Pick a reseller, pick a backup (local snapshot, offsite copy or an uploaded file), open it in a scratch copy and see counts only, then either
// "Add what is missing" (keeps everything that is there now) or "Replace this account's data" (makes the account match the backup).
// The Host never reads a record: blobs are copied as they are, and they open with the account's own key. Before any change a 7-day safety copy of the
// account is saved (the same copy the reseller's own "Undo last restore" uses). The account ends up as the backup had it, which may be a day or more old;
// the reseller owns that loss, so the confirmation, the notice to the reseller and the audit entry all say so.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { areaLogger } from '../../logging/logger.mjs';
import { listBackups, takenAtFromName } from './files.mjs';
import { enabledDestinations, clientFor } from './destinations/index.mjs';
import { getTiers } from './tiers.mjs';
import { getFullConfig } from './auto.mjs';
import { heldList, resolveSource, discardUpload } from './filetest.mjs';
import { fetchCopy, openCopy, fitCheck, inspect, sha } from './offsite.mjs';
import { getPassphrase } from './passphrase.mjs';
import { checkSqliteFile } from './testrestore.mjs';
import { makePoint } from './restorepoint.mjs';
import { saveAccountNotice } from '../announcement/index.mjs';
import { enqueueMail, processQueue } from '../mail/index.mjs';
import { siteUrl } from '../site/index.mjs';
import { coded } from './gate.mjs';
import { audit } from './audit.mjs';
import { jobStep } from './progress.mjs';
import { LATEST_MIGRATION } from '../../db/schema.mjs';

const L = areaLogger('backup');
const ok = (label, detail = '') => ({ ok: true, label, detail }), bad = (label, detail = '') => ({ ok: false, label, detail });
export const TOKEN_MS = 30 * 60e3;
const tokens = new Map();
const sweep = () => { const now = Date.now(); for (const [k, v] of tokens) if (v.exp < now) tokens.delete(k); };
export const dropToken = (t) => tokens.delete(t);
const KINDS = { fullsite: 'Full-site backup', sqlite: 'Database snapshot' };
const OFFSITE_NAME = /^myboxstock-(offsite|fullsite|snap|manual|auto)/;
const TEAM_TABLES = ['account_users', 'account_keys', 'account_roles', 'account_recovery'];
const PAGE = 1000;

// Every backup that could hold this account, newest first. A backup made before the account existed is listed but greyed out, with the reason.
export async function sourcesFor(db, accountId, actor) {
  const a = await db.get('SELECT id, created_at FROM accounts WHERE id = ?', [accountId]); if (!a) throw coded('NOT_FOUND');
  const made = Number(a.created_at), rows = [], problems = [];
  for (const b of listBackups()) {
    if (b.kind === 'sql-dump') continue;
    rows.push({ key: 'f:' + b.name, from: 'This server', source: { folder: b.name }, name: b.name, takenAt: b.takenAt, size: b.size, kind: KINDS[b.kind] || 'Backup', tier: b.tier });
  }
  try {
    const t = await getTiers(db), full = await getFullConfig(db), ids = [...new Set([...(t.offsite?.destinations || []), ...(full.destinationIds || [])])];
    for (const d of await enabledDestinations(db, ids)) {
      try { for (const f of await clientFor(d).list()) if (OFFSITE_NAME.test(f.name) && !/\.sql/.test(f.name)) rows.push({ key: `o:${d.id}:${f.name}`, from: d.name, source: { destination: d.id, name: f.name }, name: f.name, takenAt: takenAtFromName(f.name, f.mtime), size: f.size, kind: f.name.includes('-fullsite-') ? 'Full-site backup' : 'Offsite copy', tier: 'offsite' }); }
      catch (e) { problems.push({ destination: d.name, error: String(e.message).slice(0, 150) }); }
    }
  } catch (e) { problems.push({ destination: 'Offsite copies', error: String(e.message).slice(0, 150) }); }
  for (const u of heldList(actor)) rows.push({ key: 'u:' + u.id, from: 'Uploaded file', source: { upload: u.id }, name: u.name, takenAt: takenAtFromName(u.name, Date.now()), size: u.size, kind: 'Uploaded file', tier: 'upload' });
  rows.sort((x, y) => y.takenAt - x.takenAt);
  // File names carry whole seconds, so a backup within two seconds of the sign-up is not greyed.
  for (const r of rows) if (r.takenAt && r.takenAt + 2000 < made) { r.disabled = true; r.why = 'Made before this account existed.'; }
  return { rows, problems, accountCreated: made };
}

// Brings the chosen source into `dir` as a plain SQLite scratch copy. Returns { scratch, opened, size, sha, name, from, upload } or null (a failed check is in `checks`).
async function bringIn(db, source, dir, pass, checks, actor) {
  let file, name, size, hash, from, upload = null, stat = null;
  if (source?.destination) {
    name = String(source.name || ''); const f = await fetchCopy(db, String(source.destination), name, dir, checks); if (!f) return null;
    ({ file, size, sha: hash, stat } = f); from = f.dest.name;
  } else {
    const r = resolveSource(source, actor); file = r.file; name = r.name; from = r.from === 'upload' ? 'Uploaded file' : 'This server'; upload = r.upload || null;
    size = fs.statSync(file).size; hash = await sha(file); checks.push(ok('The file was read', `${size} bytes`));
  }
  const p = pass || (/\.db$/.test(name) ? '' : await getPassphrase(db)), scratch = path.join(dir, 'scratch.db');
  const opened = await openCopy(db, file, name, scratch, p, checks); if (!opened) return null;
  return { scratch, opened, size, sha: hash, name, from, upload, mtime: stat?.mtime || 0 };
}

// What the backup holds for this account, read from the scratch copy. Counts only.
function readAccount(scratch, accountId) {
  const d = new DatabaseSync(scratch, { readOnly: true });
  try {
    const all = (sql, ...a) => { try { return d.prepare(sql).all(...a); } catch { return []; } };
    const acct = all('SELECT id, account_code, business_name, plan, status FROM accounts WHERE id = ?', accountId)[0] || null;
    const byType = Object.fromEntries(all('SELECT type, COUNT(*) AS n FROM records WHERE account_id = ? GROUP BY type', accountId).map(r => [r.type, Number(r.n)]));
    const team = Number(all('SELECT COUNT(*) AS n FROM account_users WHERE account_id = ?', accountId)[0]?.n || 0);
    const newest = Number(Object.values(all('SELECT MAX(updated_at) AS n FROM records WHERE account_id = ?', accountId)[0] || {})[0] || 0);
    return { found: !!acct, counts: { devices: byType.item || 0, customers: byType.customer || 0, sales: byType.sale || 0, models: byType.model || 0, settings: byType.config || 0, team }, newest };
  } finally { d.close(); }
}
async function liveCounts(db, accountId) {
  const byType = Object.fromEntries((await db.all('SELECT type, COUNT(*) AS n FROM records WHERE account_id = ? GROUP BY type', [accountId])).map(r => [r.type, Number(r.n)]));
  const team = Number((await db.get('SELECT COUNT(*) AS n FROM account_users WHERE account_id = ?', [accountId])).n);
  const newest = Number((await db.get('SELECT MAX(updated_at) AS n FROM records WHERE account_id = ?', [accountId]))?.n || 0);
  return { counts: { devices: byType.item || 0, customers: byType.customer || 0, sales: byType.sale || 0, models: byType.model || 0, settings: byType.config || 0, team }, newest };
}

// Step 1: open the backup in a scratch copy and show what it holds for this account. Never changes anything. A pass gives a one-time token for the restore.
export async function previewReseller(db, { accountId, source, passphrase = '', actor = null, ip = null } = {}) {
  if (db.client !== 'sqlite') throw coded('HOST_BACKUP_SQLITE_ONLY');
  const acct = await db.get('SELECT id, account_code, business_name FROM accounts WHERE id = ?', [accountId]); if (!acct) throw coded('NOT_FOUND');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-resellerprev-')), checks = []; let got = null, inBackup = null, live = null, takenAt = 0;
  try {
    got = await bringIn(db, source, dir, passphrase, checks, actor);
    if (got) {
      jobStep('Checking the database', 85, 92); const r = checkSqliteFile(got.scratch); checks.push(...r.checks.map(c => c.label === 'The database passes its integrity check' ? { ...c, label: 'The database passes its integrity check (opened in a scratch copy)' } : c));
      if (r.counts) {
        const facts = inspect(got.scratch); checks.push(fitCheck(facts, got.opened.manifest));
        jobStep('Finding this account', 92, 99); inBackup = readAccount(got.scratch, accountId); live = await liveCounts(db, accountId);
        takenAt = got.opened.manifest ? Date.parse(got.opened.manifest.createdAt) || takenAtFromName(got.name, got.mtime) : takenAtFromName(got.name, got.mtime || Date.now());
        checks.push(inBackup.found ? ok('This reseller is in the backup', `${acct.business_name} (${acct.account_code})`) : bad('This reseller is in the backup', `${acct.business_name} did not exist when this backup was made, so there is nothing to restore from it.`));
      }
      got.opened.bundle?.cleanup?.();
    }
  } catch (e) { checks.push(bad('The backup could be checked', e.message)); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  checks.push(ok('The scratch copy was deleted', 'Nothing on the live site was changed.'));
  const pass = !!got && !!inBackup?.found && checks.every(c => c.ok); sweep(); let token = null;
  if (pass) {
    for (const [k, v] of tokens) if (v.actor === actor && v.accountId === accountId) tokens.delete(k);
    token = crypto.randomBytes(24).toString('hex'); tokens.set(token, { actor, accountId, source, name: got.name, size: got.size, sha: got.sha, takenAt, exp: Date.now() + TOKEN_MS });
  }
  const failed = checks.find(c => !c.ok);
  audit('backup.reseller_test', `Looked inside ${got?.name || 'a backup'} for ${acct.account_code}: ${pass ? 'found the reseller' : 'FAILED'}`, { actor, ip, level: pass ? 'info' : 'warn', data: { accountCode: acct.account_code, name: got?.name, ok: pass } });
  return { ok: pass, checks, token, expiresInMs: token ? TOKEN_MS : 0, backup: got ? { name: got.name, from: got.from, takenAt, size: got.size } : null, inBackup, live,
    summary: pass ? 'This backup holds the reseller. Nothing has been changed yet.' : `This backup cannot be used. ${failed?.detail || failed?.label || 'It could not be checked.'}` };
}

// Columns present in both databases, so a backup made by an older version still copies cleanly.
const sharedColumns = async (t, d, table) => {
  const have = new Set((await t.all(`PRAGMA table_info(${table})`)).map(c => c.name));
  let theirs = []; try { theirs = d.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name); } catch { return []; }
  return theirs.filter(c => have.has(c));
};
function* pages(d, sql, ...args) { for (let off = 0; ; off += PAGE) { const rows = d.prepare(`${sql} LIMIT ${PAGE} OFFSET ${off}`).all(...args); if (!rows.length) return; yield rows; if (rows.length < PAGE) return; } }

export const noticeText = (takenAt, mode) => `Your provider restored your data from the backup taken on ${new Date(takenAt).toISOString().slice(0, 16).replace('T', ' ')} UTC. ${mode === 'replace' ? 'Your account now matches that backup, so anything you added or changed after that time is not in it.' : 'Anything that was missing from your account and was in that backup has been added back. Nothing you already had was changed.'} If you have your own backup file (.mbsbackup) from after that time, open Backup, choose Restore from a backup file, and pick “Add what is missing” to bring those newer entries back. You can also use Undo last restore on the Backup page for the next 7 days.`;

// Step 2: do it. Needs the token from a passing preview, the mode, and the business name typed exactly.
export async function restoreReseller(db, { token, accountId, mode, includeTeam = false, confirmName = '', passphrase = '', notify = false, actor = null, ip = null } = {}) {
  if (db.client !== 'sqlite') throw coded('HOST_BACKUP_SQLITE_ONLY');
  sweep(); const t = tokens.get(String(token || ''));
  if (!t || t.actor !== actor || t.accountId !== accountId) throw coded('HOST_BACKUP_COPY_NOT_TESTED');
  if (!['add', 'replace'].includes(mode)) throw Object.assign(new Error('Choose Add what is missing or Replace this account’s data.'), { status: 400 });
  const acct = await db.get('SELECT id, account_code, business_name, owner_email, demo FROM accounts WHERE id = ?', [accountId]); if (!acct) throw coded('NOT_FOUND');
  if (String(confirmName).trim() !== acct.business_name) throw Object.assign(new Error('Type the business name exactly as shown to confirm.'), { status: 400 });
  if (includeTeam && mode !== 'replace') throw Object.assign(new Error('The team can only be restored with Replace this account’s data.'), { status: 400 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-resellerrest-')), checks = [];
  try {
    jobStep('Opening the backup again', 2, 40);
    const got = await bringIn(db, t.source, dir, passphrase, checks, actor); if (!got) throw new Error(checks.find(c => !c.ok)?.detail || 'The backup could not be opened.');
    if (got.size !== t.size || got.sha !== t.sha) throw coded('HOST_BACKUP_COPY_CHANGED');
    if (inspect(got.scratch).migration > LATEST_MIGRATION) throw new Error('This backup comes from a newer version of the app.');
    jobStep('Saving a safety copy of this account', 40, 55);
    const point = await makePoint(db, accountId, `${actor} (Host)`, mode === 'replace' ? 'replace' : 'merge');
    jobStep('Copying the account’s data', 55, 95);
    const d = new DatabaseSync(got.scratch, { readOnly: true }); let added = 0, replaced = 0, removed = 0, team = 0;
    try {
      await db.tx(async (tx) => {
        const cols = await sharedColumns(tx, d, 'records'); const insert = `INSERT INTO records (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
        const now = Date.now();
        if (mode === 'add') {
          for (const rows of pages(d, 'SELECT * FROM records WHERE account_id = ? ORDER BY created_at, id', accountId)) for (const r of rows) {
            if (await tx.get('SELECT id FROM records WHERE id = ?', [r.id])) continue;
            await tx.run(insert, cols.map(c => c === 'rev' ? 1 : c === 'updated_at' ? now : r[c])); added++;
          }
        } else {
          const revs = new Map((await tx.all('SELECT id, rev FROM records WHERE account_id = ?', [accountId])).map(r => [r.id, Number(r.rev)]));
          removed = revs.size; await tx.run('DELETE FROM records WHERE account_id = ?', [accountId]);
          for (const rows of pages(d, 'SELECT * FROM records WHERE account_id = ? ORDER BY created_at, id', accountId)) for (const r of rows) {
            const prev = revs.get(r.id); if (prev != null) { replaced++; removed--; } else added++;
            await tx.run(insert, cols.map(c => c === 'rev' ? Math.max(Number(r.rev) || 1, prev || 0) + 1 : c === 'updated_at' ? now : r[c]));   // revisions move forward so open browsers re-read everything
          }
          if (includeTeam) {
            const ids = (await tx.all('SELECT id FROM account_users WHERE account_id = ?', [accountId])).map(u => u.id);
            for (const id of ids) { await tx.run("DELETE FROM sessions WHERE realm = 'app' AND subject_id = ?", [id]); await tx.run("DELETE FROM password_resets WHERE realm = 'app' AND subject_id = ?", [id]); await tx.run('DELETE FROM admin_links WHERE user_id = ?', [id]); }
            for (const table of ['account_keys', 'account_users', 'account_roles', 'account_recovery']) await tx.run(`DELETE FROM ${table} WHERE account_id = ?`, [accountId]);
            for (const table of ['account_roles', 'account_users', 'account_keys', 'account_recovery']) {
              const tc = await sharedColumns(tx, d, table); if (!tc.includes('account_id')) continue;
              for (const rows of pages(d, `SELECT * FROM ${table} WHERE account_id = ?`, accountId)) for (const r of rows) { await tx.run(`INSERT INTO ${table} (${tc.join(',')}) VALUES (${tc.map(() => '?').join(',')})`, tc.map(c => r[c])); if (table === 'account_users') team++; }
            }
          }
        }
      });
    } finally { d.close(); got.opened.bundle?.cleanup?.(); }
    jobStep('Telling the reseller', 95, 99);
    await saveAccountNotice(db, accountId, { text: noticeText(t.takenAt, mode), level: 'important' });
    if (notify && acct.owner_email && !acct.demo) { await enqueueMail(db, acct.owner_email, 'host_announcement', { name: acct.business_name, notice: noticeText(t.takenAt, mode), url: await siteUrl(db).catch(() => '') }); processQueue(db).catch(() => {}); }
    tokens.delete(token); if (got.upload) discardUpload(got.upload, actor);
    const summary = mode === 'add' ? `${added} record${added === 1 ? '' : 's'} added` : `${replaced + added} record${replaced + added === 1 ? '' : 's'} restored, ${removed} removed${includeTeam ? `, ${team} team member${team === 1 ? '' : 's'} restored` : ''}`;
    L.warn('reseller_restore', `Restored ${acct.account_code} from ${got.name} (${mode}): ${summary}`, { actor, accountId, data: { name: got.name, mode, includeTeam } });
    audit('backup.reseller_restore', `Restored reseller ${acct.account_code} (${acct.business_name}) from ${got.name}, backup taken ${new Date(t.takenAt).toISOString()} — ${mode === 'add' ? 'add what is missing' : 'replace this account’s data'}: ${summary}. Safety copy of the account kept until ${new Date(point.expiresAt).toISOString().slice(0, 10)}.`, { actor, ip, level: 'warn', data: { accountCode: acct.account_code, name: got.name, mode, includeTeam, added, replaced, removed, team, emailed: !!notify, takenAt: t.takenAt } });
    return { ok: true, mode, added, replaced, removed, team, summary, safetyUntil: point.expiresAt, takenAt: t.takenAt };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
