// TEST / backup-api — last-backup time, restore point and undo (with expiry), wrong-account refusal, diagnostics without tenant data, and the backup file format.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, ROOT } from './helpers.mjs';
import { Vault, enableVault, putRecord, readRecords } from './vault-helper.mjs';

const PW = 'Sup3rSecretPass!', SECRETS = ['Zelda Fitzgerald', 'SERIAL-SECRET-7731', 'MAC-AA:BB:CC:11', 'S-RCPT-4455'];
const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let srv, admin, std, keys, code, ipn = 1; const mk = () => { const c = new Client(srv.base); c.headers = { 'X-Forwarded-For': `10.8.${ipn++}.1` }; return c; };
test.before(async () => {
  srv = await startServer({ TRUST_PROXY: '1' }); admin = mk(); std = mk();
  const host = mk(); await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  let r = await admin.req('POST', '/api/app/signup', { businessName: 'Backup Co', email: 'b@example.com', username: 'bea', password: PW }); code = r.data.accountCode;
  await admin.req('POST', '/api/app/login', { login: r.data.login, password: PW }); keys = await enableVault(admin, PW);
  const temp = 'Temp-pass-12345'; r = await admin.req('POST', '/api/app/users', { username: 'stan', role: 'Standard', password: temp, keys: await Vault.keysFor(temp, keys.adk) });
  await std.req('POST', '/api/app/login', { login: `stan@${code}`, password: temp });
});
test.after(() => srv?.stop());

test('last backup time starts empty, is set by the browser, and is for Administrators only', async () => {
  assert.equal((await admin.req('GET', '/api/app/backup/status')).data.lastBackupAt, null);
  assert.equal((await std.req('GET', '/api/app/backup/status')).status, 403);
  assert.equal((await std.req('POST', '/api/app/backup/made', {})).status, 403);
  const r = await admin.req('POST', '/api/app/backup/made', { devices: 2, customers: 1, sales: 1, records: 4 }); assert.equal(r.status, 200);
  const s = (await admin.req('GET', '/api/app/backup/status')).data; assert.ok(Math.abs(s.lastBackupAt - Date.now()) < 5000); assert.equal(s.restorePoint, null);
});

test('restore point: wrong account refused, safety copy made, undo puts it back, expiry removes it', async () => {
  const a = await putRecord(admin, keys.adk, 'item', { uid: 'one', serial: SECRETS[1] }), b = await putRecord(admin, keys.adk, 'customer', { name: SECRETS[0] });
  assert.equal((await std.req('POST', '/api/app/backup/restore/begin', { accountCode: code, mode: 'merge' })).status, 403);
  let r = await admin.req('POST', '/api/app/backup/restore/begin', { accountCode: 'amber-fox-0000', mode: 'merge' }); assert.equal(r.status, 400); assert.equal(r.data.code, 'BACKUP_WRONG_ACCOUNT');
  assert.equal((await admin.req('GET', '/api/app/backup/status')).data.restorePoint, null, 'a refused file makes no safety copy');
  assert.equal((await admin.req('POST', '/api/app/backup/restore/begin', { accountCode: code, mode: 'bogus' })).status, 400);
  assert.equal((await admin.req('POST', '/api/app/backup/undo', {})).status, 404, 'nothing to undo yet');
  r = await admin.req('POST', '/api/app/backup/restore/begin', { accountCode: code.toUpperCase(), mode: 'replace' }); assert.equal(r.status, 200); assert.equal(r.data.restorePoint.count, 2);
  // the "restore": remove one record, change another, add a third
  await admin.req('POST', '/api/app/vault/batch', { puts: [{ id: b.id, type: 'customer', rev: 1, blob: await Vault.seal(keys.adk, { name: 'Changed' }, b.id, 'customer') }], deletes: [{ id: a.id }] });
  await putRecord(admin, keys.adk, 'item', { uid: 'three' });
  assert.equal((await readRecords(admin, keys.adk)).items.length, 2);
  r = await admin.req('POST', '/api/app/backup/undo', {}); assert.equal(r.status, 200); assert.equal(r.data.count, 2);
  const after = (await readRecords(admin, keys.adk)).items; assert.equal(after.length, 2);
  assert.deepEqual(after.map(x => x.data.uid || x.data.name).sort(), ['Zelda Fitzgerald', 'one']);
  assert.ok(after.every(x => x.rev >= 2), 'revisions move forward so open browsers re-read');
  assert.equal((await admin.req('POST', '/api/app/backup/undo', {})).status, 404, 'a safety copy can be used once');
  if (sqlite) {
    await admin.req('POST', '/api/app/backup/restore/begin', { accountCode: code, mode: 'merge' }); assert.ok((await admin.req('GET', '/api/app/backup/status')).data.restorePoint);
    const db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); db.exec('PRAGMA busy_timeout=5000'); db.prepare('UPDATE restore_points SET expires_at = 1').run(); db.close();
    assert.equal((await admin.req('GET', '/api/app/backup/status')).data.restorePoint, null, 'expired after 7 days');
    assert.equal((await admin.req('POST', '/api/app/backup/undo', {})).status, 404);
  }
});

test('the safety copy holds only ciphertext', async () => {
  if (!sqlite) return;
  await admin.req('POST', '/api/app/backup/restore/begin', { accountCode: code, mode: 'merge' });
  const db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')), rows = db.prepare('SELECT blob FROM restore_point_records').all(); db.close();
  assert.ok(rows.length >= 2); for (const x of rows) for (const s of SECRETS) assert.ok(!x.blob.includes(s));
});

test('diagnostics: useful facts, Administrators only, and no inventory, customer or sale content', async () => {
  await putRecord(admin, keys.adk, 'item', { uid: 'u9', serial: SECRETS[1], mac: SECRETS[2] }); await putRecord(admin, keys.adk, 'sale', { no: SECRETS[3], customerName: SECRETS[0] });
  assert.equal((await std.req('GET', '/api/app/diagnostics')).status, 403);
  await new Promise(r => setTimeout(r, 600));
  const r = await admin.req('GET', '/api/app/diagnostics'); assert.equal(r.status, 200); const t = r.data.text;
  for (const want of ['App version:', 'Build:', 'Device:', `Reseller ID: ${code}`, 'Plan:', 'Billing:', 'Users: 2 (Administrator 1, Standard 1)', 'Two-factor: 0 of 2', 'Encryption: on', 'Last full backup:', 'Recent warnings and errors', 'backup.restore_refused']) assert.ok(t.includes(want), `has "${want}":\n${t}`);
  for (const s of SECRETS) assert.ok(!t.includes(s), `no tenant content: ${s}`);
  assert.ok(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(t), 'no IP addresses'); assert.ok(!t.includes(PW) && !t.includes('Temp-pass'));
});

test('backup file: readable header only, everything else sealed; wrong account, wrong key and damage are refused in plain words', async () => {
  globalThis.AccountApp = {}; vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'public/js/app/backup-file.js'), 'utf8'));
  const BF = globalThis.AccountApp.backupFile, recs = (await admin.req('GET', '/api/app/vault/records')).data.records, rec = (await admin.req('GET', '/api/app/vault/recovery')).data.wrappedAdk;
  const text = await BF.build({ adk: keys.adk, accountCode: code, appVersion: '9.9.9', records: recs, keys: null, recoveryWrappedAdk: rec });
  for (const s of SECRETS) assert.ok(!text.includes(s), `file has no readable ${s}`);
  const f = JSON.parse(text); assert.deepEqual(Object.keys(f).sort(), ['account', 'app', 'createdAt', 'format', 'keys', 'manifest', 'records', 'v']);
  assert.match(BF.fileName(code, Date.UTC(2026, 5, 3, 12)), new RegExp(`^myboxstock-backup-${code}-2026060\\d\\.mbsbackup$`));
  const ok = await BF.read(text, { adk: keys.adk, accountCode: code }); assert.equal(ok.records.length, recs.length); assert.equal(ok.manifest.counts.devices, 2); assert.equal(ok.manifest.counts.customers, 1); assert.equal(ok.manifest.counts.sales, 1);
  const viaRecovery = await Vault.unwrapWithRecovery(f.keys.recovery, keys.recovery); assert.ok(await BF.read(text, { adk: viaRecovery, accountCode: code }), 'the recovery key inside the file opens it');
  await assert.rejects(BF.read(text, { adk: keys.adk, accountCode: 'other-fox-1111' }), /different account/);
  await assert.rejects(BF.read(text, { adk: await Vault.newAdk(), accountCode: code }), /different key/);
  await assert.rejects(BF.read(JSON.stringify({ ...f, records: f.records.slice(1) }), { adk: keys.adk, accountCode: code }), /damaged or incomplete/);
  await assert.rejects(BF.read('not json', { adk: keys.adk, accountCode: code }), /not a myBoxStock backup/);
  await assert.rejects(BF.read(JSON.stringify({ ...f, v: 99 }), { adk: keys.adk, accountCode: code }), /newer version/);
});
