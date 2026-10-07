// TEST / backup-team — the sealed Team list in the .mbsbackup, Test a backup file's checks and comparison, and team members coming back as pending invitations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { startServer, Client, ROOT, readJsonl } from './helpers.mjs';
import { Vault, enableVault, putRecord } from './vault-helper.mjs';

const PW = 'Sup3rSecretPass!', TEMP = 'Temp-pass-12345';
let srv, admin, std, keys, code, ipn = 1, BF; const mk = () => { const c = new Client(srv.base); c.headers = { 'X-Forwarded-For': `10.7.${ipn++}.1` }; return c; };
const PEOPLE = [{ username: 'newbie', email: 'newbie@example.com', role: 'Standard' }, { username: 'viewer.vi', email: 'vi@example.com', role: 'View' }, { username: 'bossy', email: 'boss@example.com', role: 'Administrator' }];
const users = async () => (await admin.req('GET', '/api/app/users')).data;
const begin = (mode = 'merge') => admin.req('POST', '/api/app/backup/restore/begin', { accountCode: code, mode });
test.before(async () => {
  srv = await startServer({ TRUST_PROXY: '1' }); admin = mk(); std = mk();
  const host = mk(); await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  const r = await admin.req('POST', '/api/app/signup', { businessName: 'Team Co', email: 't@example.com', username: 'tess', password: PW }); code = r.data.accountCode;
  await admin.req('POST', '/api/app/login', { login: r.data.login, password: PW }); keys = await enableVault(admin, PW);
  await admin.req('POST', '/api/app/users', { username: 'stan', email: 'stan@example.com', role: 'Standard', password: TEMP, keys: await Vault.keysFor(TEMP, keys.adk) });
  await putRecord(admin, keys.adk, 'item', { uid: 'x1' });
  globalThis.AccountApp = {}; vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'public/js/app/backup-file.js'), 'utf8')); BF = globalThis.AccountApp.backupFile;
});
test.after(() => srv?.stop());

test('the file holds a sealed Team list: no readable names, emails, passwords or secrets', async () => {
  const recs = (await admin.req('GET', '/api/app/vault/records')).data.records, rec = (await admin.req('GET', '/api/app/vault/recovery')).data.wrappedAdk;
  const live = BF.cleanPeople(await users()); assert.deepEqual(live.map(p => p.username).sort(), ['stan', 'tess']);
  assert.deepEqual(Object.keys(live[0]).sort(), ['email', 'role', 'username'], 'only username, email and role are ever taken');
  const text = await BF.build({ adk: keys.adk, accountCode: code, appVersion: '9.9.9', records: recs, keys: null, recoveryWrappedAdk: rec, team: [...live, ...PEOPLE, { username: 'xx1', password: 'LEAK', totp_secret: 'LEAK', pw_hash: 'LEAK', role: 'View' }] });
  for (const s of ['stan', 'tess', 'newbie', 'newbie@example.com', 'stan@example.com', 'LEAK', 'pw_hash', 'totp', 'scrypt']) assert.ok(!text.includes(s), `the file has no readable "${s}"`);
  const f = JSON.parse(text); assert.deepEqual(Object.keys(f).sort(), ['account', 'app', 'createdAt', 'format', 'keys', 'manifest', 'records', 'team', 'v']); assert.equal(typeof f.team, 'string');
  const ok = await BF.read(text, { adk: keys.adk, accountCode: code });
  assert.equal(ok.team.length, live.length + PEOPLE.length + 1); assert.deepEqual(ok.team.find(p => p.username === 'xx1'), { username: 'xx1', email: '', role: 'View' }, 'extra fields are dropped');
  assert.equal(BF.teamText(PEOPLE), '1 Administrator, 1 Standard, 1 View');
  await assert.rejects(BF.read(JSON.stringify({ ...f, team: f.team.slice(0, -4) + 'AAAA' }), { adk: keys.adk, accountCode: code }), /team list cannot be opened/);
  const none = await BF.read(await BF.build({ adk: keys.adk, accountCode: code, appVersion: '1', records: recs, keys: null, recoveryWrappedAdk: rec }), { adk: keys.adk, accountCode: code }); assert.equal(none.team, null, 'a file with no team list reads fine');
});

test('Test a backup file: each check passes in order, stops at the first failure, and opens every record', async () => {
  const recs = (await admin.req('GET', '/api/app/vault/records')).data.records, rec = (await admin.req('GET', '/api/app/vault/recovery')).data.wrappedAdk;
  const build = (over = {}) => BF.build({ adk: keys.adk, accountCode: code, appVersion: '1', records: recs, keys: null, recoveryWrappedAdk: rec, team: PEOPLE, ...over });
  const run = (text, adk = keys.adk, account = code) => BF.check(text, { adk, accountCode: account, records: true });
  const good = await run(await build()); assert.ok(good.parsed); assert.deepEqual(good.steps.map(s => [s.id, s.ok]), [['format', true], ['account', true], ['key', true], ['complete', true], ['records', true], ['team', true]]);
  const other = await run(await build(), keys.adk, 'amber-fox-0000'); assert.deepEqual(other.steps.map(s => s.ok), [true, false, null, null, null, null]); assert.match(other.steps[1].message, /different account/);
  const diff = await run(await build(), await Vault.newAdk()); assert.deepEqual(diff.steps.map(s => s.ok).slice(0, 4), [true, true, false, null]); assert.match(diff.steps[2].message, /different key/);
  const f = JSON.parse(await build()); f.records[0] = f.records[0].slice(0, -3) + 'AAA';
  const dmg = await run(JSON.stringify(f)); assert.equal(dmg.steps[3].ok, false); assert.match(dmg.steps[3].message, /damaged or incomplete/);
  const junk = await run('hello'); assert.equal(junk.steps[0].ok, false); assert.match(junk.steps[0].message, /not a myBoxStock backup/);
  // a record that has been changed AND had the checksum made to match (so only opening it can tell)
  const bad = recs.map((r, i) => i === 0 ? { ...r, blob: r.blob.slice(0, -3) + 'AAA' } : r);
  const tam = await run(await build({ records: bad })); assert.deepEqual(tam.steps.map(s => s.ok), [true, true, true, true, false, null]); assert.match(tam.steps[4].message, /one of its records cannot be opened/);
  assert.ok((await BF.check(await build({ records: bad }), { adk: keys.adk, accountCode: code })).parsed, 'a restore does not open every record, the test does');
});

test('comparison with the account now, from ids and revisions only', async () => {
  const mkP = (rows) => ({ records: rows.map(([id, type, rev]) => ({ id, type, rev })) });
  const file = mkP([['a', 'item', 1], ['b', 'item', 1], ['c', 'customer', 2], ['d', 'sale', 1], ['e', 'catalog', 1]]);
  const now = [{ id: 'a', type: 'item', rev: 1 }, { id: 'b', type: 'item', rev: 3 }, { id: 'c', type: 'customer', rev: 2 }, { id: 'n1', type: 'item', rev: 1 }, { id: 'n2', type: 'sale', rev: 1 }];
  const c = BF.compare(file, now);
  assert.deepEqual(c.by.devices, { added: 1, changed: 1, missing: 0, same: 1 }); assert.deepEqual(c.by.customers, { added: 0, changed: 0, missing: 0, same: 1 });
  assert.deepEqual(c.by.sales, { added: 1, changed: 0, missing: 1, same: 0 }); assert.deepEqual(c.by.other, { added: 0, changed: 0, missing: 1, same: 0 });
  assert.deepEqual(c.total, { added: 2, changed: 1, missing: 2, same: 2 }); assert.equal(c.older, true);
  assert.equal(BF.compare(file, file.records.map(r => ({ ...r }))).older, false);
  assert.deepEqual(BF.compareTeam(PEOPLE, [{ username: 'NEWBIE', email: '' }, { username: 'zed', email: 'BOSS@example.com' }]), { already: 2, wouldAdd: 1 });
});

test('restore: team members come back as pending invitations, no duplicates, no passwords, and undo removes them', async () => {
  const before = await users(); assert.equal(before.length, 2);
  await std.req('POST', '/api/app/login', { login: `stan@${code}`, password: TEMP });
  assert.equal((await std.req('POST', '/api/app/backup/restore/team', { people: PEOPLE })).status, 403, 'Administrators only');
  assert.equal((await admin.req('POST', '/api/app/backup/restore/team', { people: PEOPLE })).status, 404, 'needs a restore in progress (the safety copy)');
  assert.equal((await begin('replace')).status, 200);
  assert.equal((await admin.req('POST', '/api/app/backup/restore/team', { people: 'nope' })).data.code, 'BACKUP_BAD');
  const people = [...PEOPLE, { username: 'STAN', email: '', role: 'View' }, { username: 'other', email: 'Stan@Example.com', role: 'View' }, { username: 'newbie', email: '', role: 'View' }, { username: 'oddrole', email: '', role: 'Wizard' }, { username: 'a b', email: '', role: 'View' }];
  const r = await admin.req('POST', '/api/app/backup/restore/team', { people }); assert.equal(r.status, 200); assert.equal(r.data.added, 3);
  assert.deepEqual(r.data.skipped.map(s => `${s.username}:${s.reason}`).sort(), ['a b:invalid', 'newbie:exists', 'oddrole:role', 'other:exists', 'stan:exists']);
  const now = await users(); assert.equal(now.length, 5); assert.equal(now.filter(u => u.pending).length, 3);
  const nb = now.find(u => u.username === 'newbie'); assert.equal(nb.role, 'Standard'); assert.equal(nb.email, 'newbie@example.com'); assert.equal(nb.login, `newbie@${code}`);
  assert.equal(now.find(u => u.username === 'stan').role, 'Standard', 'an existing member is not changed'); assert.ok(!now.find(u => u.username === 'stan').pending);
  const tryIn = mk(); for (const pw of [TEMP, 'invited', '!invited:']) assert.equal((await tryIn.req('POST', '/api/app/login', { login: `newbie@${code}`, password: pw })).status, 401, 'nobody can sign in as a pending invitation');
  // setting up access gives a real password and ends the invitation
  const vi = now.find(u => u.username === 'viewer.vi'); assert.equal((await admin.req('POST', `/api/app/users/${vi.id}/reset-access`, { password: TEMP, keys: await Vault.keysFor(TEMP, keys.adk) })).status, 200);
  assert.ok(!(await users()).find(u => u.username === 'viewer.vi').pending); assert.equal((await mk().req('POST', '/api/app/login', { login: `viewer.vi@${code}`, password: TEMP })).status, 200);
  // undo removes what the restore added and is still pending (never someone who already has access), and leaves everyone else
  const u = await admin.req('POST', '/api/app/backup/undo', {}); assert.equal(u.status, 200); assert.equal(u.data.invitations, 2);
  assert.deepEqual((await users()).map(x => x.username).sort(), ['stan', 'tess', 'viewer.vi']);
  const log = readJsonl(srv.logDir, 'tenant').map(l => l.event || ''); assert.ok(log.includes('backup.team_restored') && log.includes('user.invited_from_backup') && log.includes('backup.team_removed'), 'everything is logged');
  assert.ok(!JSON.stringify(readJsonl(srv.logDir, 'tenant')).includes('newbie@example.com'), 'no email addresses in the log');
});

test('a read-only account can still be tested (the test only reads); restoring is refused', { skip: (process.env.DB_CLIENT || 'sqlite') !== 'sqlite' }, async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); db.exec('PRAGMA busy_timeout=5000'); db.prepare("UPDATE accounts SET plan = 'trial', trial_ends_at = 1").run(); db.close();
  assert.equal((await admin.req('GET', '/api/app/vault/records')).status, 200); assert.equal((await admin.req('GET', '/api/app/users')).status, 200);
  assert.equal((await begin()).status, 402);
});
