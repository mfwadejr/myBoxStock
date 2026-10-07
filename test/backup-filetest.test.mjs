// TEST / backup-filetest — the Host's "Test a backup file": streamed upload with a size limit, a file already in the backup folder, the report
// (file details, plans, statuses, roles, records per account, comparison with the live site), failures, and "Restore this file" with its safeguards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, readJsonl, sleep, allLogText } from './helpers.mjs';
import { writeBundleFile } from '../src/services/backup/bundle.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase', API = '/api/host/backups', FT = `${API}/file-test`;
let srv, host, bundle, accounts = {};
const raw = (dir) => { const d = new DatabaseSync(path.join(dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); return d; };
const addRecords = (dir, id, type, n) => { const d = raw(dir); try { for (let i = 0; i < n; i++) d.prepare('INSERT INTO records (id, account_id, type, blob, rev, created_at, updated_at) VALUES (?,?,?,?,1,?,?)').run(crypto.randomUUID(), id, type, 'BLOB', Date.now(), Date.now()); } finally { d.close(); } };
const idOf = (dir, code) => { const d = raw(dir); try { return d.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code).id; } finally { d.close(); } };
// Raw upload, streamed, like the page does.
function upload(client, base, name, body, { len = true, declare = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(base + `${FT}/upload?name=${encodeURIComponent(name)}`), req = http.request(u, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': client.csrf, Cookie: Object.entries(client.jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(declare ? { 'Content-Length': declare } : len && Buffer.isBuffer(body) ? { 'Content-Length': body.length } : {}) } }, (res) => { let s = ''; res.on('data', c => { s += c; }); res.on('end', () => { let data = {}; try { data = JSON.parse(s); } catch {} resolve({ status: res.statusCode, data }); if (declare) req.destroy(); }); });
    let done = false; req.on('response', () => { done = true; }); req.on('error', (e) => { if (!done) setTimeout(() => (done ? 0 : resolve({ status: 0, data: {}, error: e.code })), 100); });
    if (declare) req.flushHeaders(); else if (Buffer.isBuffer(body)) req.end(body); else (async () => { for await (const c of body) if (!req.write(c)) await new Promise(r => req.once('drain', r)); req.end(); })().catch(reject);
  });
}
const run = (source, passphrase = PASS) => host.req('POST', `${FT}/run`, { source, passphrase });
const hostLogin = async (base, pw) => { const c = new Client(base); await c.req('POST', '/api/host/login', { login: 'admin', password: pw }); return c; };

test.before(async () => {
  if (!sqlite) return;
  srv = await startServer({ BACKUP_UPLOAD_MAX_BYTES: String(5 * 1024 * 1024) });
  host = await hostLogin(srv.base, srv.hostPw); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  for (const [bn, un] of [['Alpha Boxes', 'ann'], ['Bravo Boxes', 'bob']]) { const r = await new Client(srv.base).req('POST', '/api/app/signup', { businessName: bn, email: `${un}@example.com`, username: un, password: PW }); accounts[bn] = r.data.login.split('@')[1]; }
  const [A, Bv] = Object.values(accounts); addRecords(srv.dir, idOf(srv.dir, A), 'item', 4); addRecords(srv.dir, idOf(srv.dir, A), 'customer', 2); addRecords(srv.dir, idOf(srv.dir, A), 'sale', 3); addRecords(srv.dir, idOf(srv.dir, Bv), 'item', 1);
  const r = await host.req('POST', `${API}/bundle`, { passphrase: PASS }); assert.equal(r.status, 200, JSON.stringify(r.data)); bundle = path.join(srv.dir, 'backup', r.data.name);
});
test.after(() => srv?.stop());

test('a streamed upload is tested: file details, accounts by plan and status, users by role, records per account, and an honest note about reseller records', { skip: !sqlite && 'SQLite-only' }, async () => {
  const buf = fs.readFileSync(bundle), up = await upload(host, srv.base, 'laptop-copy.mbsbak', buf); assert.equal(up.status, 200, JSON.stringify(up.data)); assert.equal(up.data.size, buf.length);
  const r = (await run({ upload: up.data.id })).data; assert.equal(r.ok, true, JSON.stringify(r.checks)); assert.match(r.summary, /passed every check/);
  assert.ok(r.checks.some(c => /whole file passed its authenticity check/.test(c.detail)), 'the whole-file authentication is stated');
  assert.ok(r.token && r.expiresInMs > 0);
  assert.equal(r.details.kind, 'Full-site backup'); assert.equal(r.details.size, buf.length); assert.equal(r.details.readable, true); assert.equal(r.details.appVersion, JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'))).version); assert.equal(r.details.format, 2); assert.equal(r.details.sha256.length, 64);
  const p = r.report; assert.equal(p.accounts.total, 2); assert.equal(p.accounts.byPlan.trial, 2); assert.equal(p.accounts.byStatus.active, 2); assert.equal(p.users.total, 2); assert.equal(Object.values(p.users.byRole).reduce((a, b) => a + b, 0), 2, 'every user is counted under a role'); assert.ok(Object.keys(p.users.byRole).length >= 1);
  assert.deepEqual(p.records.file, { devices: 5, customers: 2, sales: 3, other: 0 });
  const [A, Bv] = Object.values(accounts), row = (c) => p.rows.find(x => x[0] === c);
  assert.deepEqual(row(A).slice(3, 7), [1, 4, 2, 3]); assert.deepEqual(row(Bv).slice(3, 7), [1, 1, 0, 0]); assert.equal(row(A)[7], 'same');
  assert.match(r.note, /Host cannot open reseller records/);
  assert.equal(p.compare.relation, 'same'); assert.equal(p.compare.onlyLiveTotal, 0); assert.equal(p.compare.differTotal, 0);
  assert.ok(!JSON.stringify(r).includes('BLOB'), 'no record content is ever in a report');
  assert.ok(!fs.readdirSync(os.tmpdir()).some(f => f.startsWith('mbs-filetest-')), 'no scratch copy is left behind');
  assert.equal((await host.req('DELETE', `${FT}/upload/${up.data.id}`)).status, 200);
  assert.equal((await run({ upload: up.data.id })).data.code, 'HOST_BACKUP_UPLOAD_GONE', 'closing the sheet removed the uploaded file');
  assert.ok(!allLogText(srv.logDir).includes(PASS), 'the passphrase is never logged');
});

test('the comparison with the live site: accounts only on the live site come first, record counts that differ, and an older file is called out', { skip: !sqlite && 'SQLite-only' }, async () => {
  const [A, Bv] = Object.values(accounts), late = await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Late Boxes', email: 'lee@example.com', username: 'lee', password: PW }), L = late.data.login.split('@')[1];
  addRecords(srv.dir, idOf(srv.dir, L), 'item', 2); addRecords(srv.dir, idOf(srv.dir, A), 'sale', 2); await sleep(30);
  fs.copyFileSync(bundle, path.join(srv.dir, 'backup', 'from-the-nas.mbsbak'));
  assert.ok((await host.req('GET', FT)).data.folder.some(f => f.name === 'from-the-nas.mbsbak'), 'a file placed in the backup folder is offered');
  const r = (await run({ folder: 'from-the-nas.mbsbak' })).data, c = r.report.compare; assert.equal(r.ok, true);
  assert.equal(c.relation, 'older'); assert.equal(c.onlyLiveTotal, 1); assert.equal(c.onlyLive[0].code, L); assert.equal(c.onlyLive[0].devices, 2);
  assert.equal(c.differTotal, 1); assert.equal(c.differ[0].code, A); assert.equal(c.differ[0].file.sales, 3); assert.equal(c.differ[0].live.sales, 5);
  assert.equal(r.report.rows.find(x => x[0] === A)[7], 'differs'); assert.equal(r.report.rows.find(x => x[0] === Bv)[7], 'same');
  const line = r.checks.find(x => /compared with the live site/.test(x.label)).detail; assert.match(line, /older than the latest activity/); assert.match(line, /1 account exist only on the live site and would be lost/);
  assert.equal(r.report.live.accounts, 3);
});

test('wrong passphrase, damaged, cut-short, empty, wrong type and a newer app version each fail and give no token', { skip: !sqlite && 'SQLite-only' }, async () => {
  const good = fs.readFileSync(bundle), put = async (name, buf) => (await upload(host, srv.base, name, buf)).data.id;
  let r = (await run({ upload: await put('a.mbsbak', good) }, 'not the right passphrase')).data; assert.equal(r.ok, false); assert.equal(r.token, null); assert.match(r.summary, /did not pass/); assert.match(JSON.stringify(r.checks), /does not open this copy|Wrong passphrase/i);
  const bad = Buffer.from(good); bad[good.length >> 1] ^= 0xff; r = (await run({ upload: await put('b.mbsbak', bad) })).data; assert.equal(r.ok, false); assert.equal(r.token, null); assert.equal(r.report, null);
  r = (await run({ upload: await put('c.mbsbak', good.subarray(0, good.length - 4000)) })).data; assert.equal(r.ok, false); assert.equal(r.token, null);
  r = (await run({ upload: await put('d.mbsbak', Buffer.from('this is not a backup, just some text')) })).data; assert.equal(r.ok, false); assert.match(JSON.stringify(r.checks), /not a myBoxStock full-site backup/);
  const e = await upload(host, srv.base, 'e.mbsbak', Buffer.alloc(0)); assert.equal(e.data.code, 'HOST_BACKUP_UPLOAD_EMPTY');
  const k = await upload(host, srv.base, 'notes.txt', Buffer.from('x')); assert.equal(k.status, 400); assert.equal(k.data.code, 'HOST_BACKUP_FILE_KIND');
  assert.equal((await upload(host, srv.base, '../../etc/passwd.mbsbak', Buffer.from('x'))).data.code, 'HOST_BACKUP_FILE_KIND');
  assert.equal((await run({ folder: '../x.mbsbak' })).data.code, 'HOST_BACKUP_FILE_KIND'); assert.equal((await run({ folder: 'missing.mbsbak' })).status, 404);
  // newer app: a well-formed file whose manifest says it came from a newer version
  const snap = path.join(os.tmpdir(), `mbs-ft-${Date.now()}.db`); const live = fs.readdirSync(path.join(srv.dir, 'backup')).find(f => /^myboxstock-snap-.*\.db$/.test(f)) || (await host.req('POST', `${API}/run/frequent`), fs.readdirSync(path.join(srv.dir, 'backup')).find(f => /^myboxstock-snap-.*\.db$/.test(f)));
  fs.copyFileSync(path.join(srv.dir, 'backup', live), snap);
  const newer = path.join(srv.dir, 'backup', 'newer-app.mbsbak'); await writeBundleFile([['manifest.json', Buffer.from(JSON.stringify({ format: 2, app: 'myBoxStock', version: '99.0.0', engine: 'sqlite', createdAt: new Date().toISOString(), database: 'database.db' }))], ['database.db', { file: snap, size: fs.statSync(snap).size }], ['secret.key', fs.readFileSync(path.join(srv.dir, 'secret.key'))]], newer, PASS); fs.rmSync(snap);
  r = (await run({ folder: 'newer-app.mbsbak' })).data; assert.equal(r.ok, false); assert.equal(r.token, null); assert.match(JSON.stringify(r.checks), /newer version of myBoxStock/); assert.equal(r.details.readable, false);
  // a plain .db snapshot needs no passphrase
  fs.copyFileSync(path.join(srv.dir, 'backup', live), path.join(srv.dir, 'backup', 'plain-copy.db')); r = (await run({ folder: 'plain-copy.db' }, '')).data; assert.equal(r.ok, true, JSON.stringify(r.checks)); assert.equal(r.details.kind, 'Database snapshot');
  assert.ok(!fs.readdirSync(os.tmpdir()).some(f => f.startsWith('mbs-filetest-') || f.startsWith('mbs-bundle-')), 'no scratch copy is left behind');
});

test('the upload size limit is stated and enforced; a big upload is streamed to disk without growing the server\'s memory', { skip: !sqlite && 'SQLite-only', timeout: 180000 }, async () => {
  const info = (await host.req('GET', FT)).data; assert.equal(info.limitBytes, 5 * 1024 * 1024);
  let r = await upload(host, srv.base, 'huge.mbsbak', Buffer.alloc(0), { declare: info.limitBytes + 10 }); assert.equal(r.status, 413); assert.equal(r.data.code, 'HOST_BACKUP_UPLOAD_TOO_BIG');
  // chunked (no declared length) uploads are cut at the limit as well
  r = await upload(host, srv.base, 'huge2.mbsbak', (async function* () { for (let i = 0; i < 12; i++) yield Buffer.alloc(1 << 20, 2); })(), { len: false }); assert.ok([413, 0].includes(r.status), 'cut at the limit (the answer may be lost when the connection closes): ' + r.status);
  assert.ok(!fs.existsSync(path.join(srv.dir, 'backup-incoming')) || fs.readdirSync(path.join(srv.dir, 'backup-incoming')).every(f => !/huge/.test(f)), 'a refused upload leaves no file');
  const big = await startServer({ BACKUP_UPLOAD_MAX_BYTES: String(2 * 1024 ** 3) }); // its own server: 400 MB streamed in, memory measured by the operating system
  try {
    const h = await hostLogin(big.base, big.hostPw); await h.req('POST', '/api/host/change-password', { current: big.hostPw, next: PW });
    const rss = () => { try { return Number(/VmHWM:\s+(\d+)/.exec(fs.readFileSync(`/proc/${big.proc.pid}/status`, 'utf8'))[1]) / 1024; } catch { return null; } };
    const before = rss(), MB = 400;
    const up = await upload(h, big.base, 'big.mbsbak', (async function* () { const piece = crypto.randomBytes(1 << 20); for (let i = 0; i < MB; i++) yield piece; })(), { len: false });
    assert.equal(up.status, 200, JSON.stringify(up.data)); assert.equal(up.data.size, MB * (1 << 20));
    assert.equal(fs.statSync(path.join(big.dir, 'backup-incoming', up.data.id + '.upload')).size, MB * (1 << 20), 'it is on disk');
    const out = (await h.req('POST', `${FT}/run`, { source: { upload: up.data.id }, passphrase: PASS })).data; assert.equal(out.ok, false); assert.match(JSON.stringify(out.checks), /not a myBoxStock full-site backup/);
    const after = rss(); if (before != null) assert.ok(after - before < 150, `server memory grew ${(after - before).toFixed(0)} MB for a ${MB} MB upload`);
    await h.req('DELETE', `${FT}/upload/${up.data.id}`); assert.equal(fs.existsSync(path.join(big.dir, 'backup-incoming', up.data.id + '.upload')), false, 'closing removes the upload');
  } finally { big.stop(); }
});

test('only a signed-in Host can use it, and every step is audited without the passphrase', { skip: !sqlite && 'SQLite-only' }, async () => {
  const anon = new Client(srv.base); for (const [m, u] of [['GET', FT], ['POST', `${FT}/run`], ['POST', `${FT}/restore`]]) assert.equal((await anon.req(m, u, m === 'GET' ? undefined : {})).status, 401, u);
  await sleep(900); const ev = readJsonl(srv.logDir, 'host').map(e => e.event);
  assert.ok(ev.includes('backup.file_upload') && ev.includes('backup.file_test'), ev.join());
  const rows = (await host.req('GET', '/api/host/audit?q=backup.file')).data.rows; assert.ok(rows.some(e => e.event === 'backup.file_test' && e.actor === 'admin') && rows.some(e => e.event === 'backup.file_upload'));
});

test('Restore this file: needs a pass in this window, the exact file, the typed word and a free lock; takes a safety copy; the site comes back on the file\'s data; and it can be undone', { skip: !sqlite && 'SQLite-only', timeout: 170000 }, async () => {
  const go = (b) => host.req('POST', `${FT}/restore`, { passphrase: PASS, ...b }), [A] = Object.values(accounts);
  assert.equal((await go({ token: 'nope', confirm: 'RESTORE' })).data.code, 'HOST_BACKUP_COPY_NOT_TESTED');
  const t = (await run({ folder: 'from-the-nas.mbsbak' })).data; assert.equal(t.ok, true);
  assert.equal((await go({ token: t.token, confirm: 'yes' })).data.code, 'HOST_BACKUP_RESTORE_CONFIRM');
  // a failed test gives no token, so nothing can be restored from it
  const bad = Buffer.from(fs.readFileSync(bundle)); bad[bad.length >> 1] ^= 1; fs.writeFileSync(path.join(srv.dir, 'backup', 'bad-copy.mbsbak'), bad);
  const f = (await run({ folder: 'bad-copy.mbsbak' })).data; assert.equal(f.token, null); assert.equal((await go({ token: f.token, confirm: 'RESTORE' })).data.code, 'HOST_BACKUP_COPY_NOT_TESTED');
  // dropping the token (closing the sheet) ends the result; testing again makes an earlier result stale
  const t0 = (await run({ folder: 'from-the-nas.mbsbak' })).data; assert.equal((await host.req('DELETE', `${FT}/token/${t0.token}`)).status, 200); assert.equal((await go({ token: t0.token, confirm: 'RESTORE' })).data.code, 'HOST_BACKUP_COPY_NOT_TESTED');
  const t1 = (await run({ folder: 'from-the-nas.mbsbak' })).data, t2 = (await run({ folder: 'from-the-nas.mbsbak' })).data; assert.equal((await go({ token: t1.token, confirm: 'RESTORE' })).data.code, 'HOST_BACKUP_COPY_NOT_TESTED');
  // the file changes after the test: refused
  const file = path.join(srv.dir, 'backup', 'from-the-nas.mbsbak'), good = fs.readFileSync(file); fs.writeFileSync(file, Buffer.concat([good, Buffer.from('x')]));
  assert.equal((await go({ token: t2.token, confirm: 'RESTORE' })).data.code, 'HOST_BACKUP_COPY_CHANGED'); fs.writeFileSync(file, good);
  assert.ok(readJsonl(srv.logDir, 'host').some(e => e.event === 'backup.restore' && e.level === 'warn' && /refused/.test(e.message)), 'a refused restore is audited');
  // the real restore
  const late = (await host.req('GET', '/api/host/accounts')).data; void late;
  const t3 = (await run({ folder: 'from-the-nas.mbsbak' })).data, res = await go({ token: t3.token, confirm: 'RESTORE' }); assert.equal(res.status, 200, JSON.stringify(res.data)); assert.equal(res.data.restarting, true);
  assert.match(res.data.safetyCopy, /^myboxstock-pre-restore-.*\.db$/); assert.ok(fs.existsSync(path.join(srv.dir, 'backup', res.data.safetyCopy)), 'the safety copy exists');
  await new Promise(r => srv.proc.once('exit', r));
  const b = await startServer({ DATA_DIR: srv.dir }), h2 = await hostLogin(b.base, PW);
  try {
    const list = (await h2.req('GET', '/api/host/accounts')).data; const codes = JSON.stringify(list); assert.ok(codes.includes(A) && !codes.includes('Late Boxes'), 'the account made after the file is gone');
    const a = (await h2.req('GET', '/api/host/settings')).data.announcement; assert.equal(a.enabled, true); assert.match(a.text, /The site was restored from a backup taken/);
    const ev = readJsonl(b.logDir, 'host'); assert.ok(ev.some(e => e.event === 'backup.restore' && /Restore from the backup file from-the-nas\.mbsbak/.test(e.message) && e.actor === 'admin'), 'the restore is audited');
    // undo: the safety copy is on the Safety copies tab and restores the account made after the file
    const back = await h2.req('POST', `${API}/${res.data.safetyCopy}/restore`, { confirm: 'RESTORE' }); assert.equal(back.status, 200);
  } finally { await sleep(900); b.stop(); }
});
