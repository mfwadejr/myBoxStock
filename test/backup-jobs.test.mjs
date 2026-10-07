// TEST / backup-jobs — long Host jobs run in the background, one at a time: progress and steps, the result after the sheet closed, a second job refused,
// failures reported, detached results drop their one-time token, a restore job reports "restarting", and everything is in the audit trail.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, readJsonl, sleep, allLogText } from './helpers.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase', API = '/api/host/backups', JOBS = `${API}/jobs`;
let srv, host, acct;
const raw = (dir) => { const d = new DatabaseSync(path.join(dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); return d; };
// Pads the database with incompressible records so a backup of it takes long enough to watch.
const pad = (dir, id, mb) => { const d = raw(dir); try { for (let i = 0; i < mb; i++) d.prepare('INSERT INTO records (id, account_id, type, blob, rev, created_at, updated_at) VALUES (?,?,?,?,?,?,?)').run(crypto.randomUUID(), id, 'item', crypto.randomBytes(1 << 20), 1, Date.now(), Date.now()); } finally { d.close(); } };
const start = (kind, extra = {}) => host.req('POST', JOBS, { kind, ...extra });
const current = async () => (await host.req('GET', `${JOBS}/current`)).data;
// Polls until the job is no longer running; returns every state seen.
async function watch(id, { every = 40 } = {}) {
  const seen = [];
  for (let i = 0; i < 6000; i++) { const j = (await current()).job; if (j && j.id === id) { seen.push(j); if (j.status !== 'running') return seen; } await sleep(every); }
  throw new Error('job did not finish');
}
const clear = async () => { const j = (await current()).job; if (j) await host.req('POST', `${JOBS}/${j.id}/dismiss`); };

test.before(async () => {
  if (!sqlite) return;
  srv = await startServer({ BACKUP_UPLOAD_MAX_BYTES: String(50 * 1024 * 1024) });
  host = new Client(srv.base); await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 }); // the test polls fast
  await host.req('PUT', `${API}/full`, { enabled: false, passphrase: PASS, keepDaily: 14, keepWeekly: 8 });
  const s = await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Jobs Boxes', email: 'j@example.com', username: 'joe', password: PW }); acct = s.data;
});
test.after(() => srv?.stop());

test('a Test restore runs in the background: it starts at once, reports steps and a rising percentage, and its result is fetched after it finished', { skip: !sqlite && 'SQLite-only', timeout: 120000 }, async () => {
  const made = await host.req('POST', `${API}/bundle`, { passphrase: PASS }); assert.equal(made.status, 200);
  const r = await start('test-restore', { name: made.data.name, passphrase: PASS }); assert.equal(r.status, 202, JSON.stringify(r.data));
  assert.equal(r.data.job.status, 'running'); assert.match(r.data.job.label, /Test restore of myboxstock-fullsite/); assert.ok(!JSON.stringify(r.data).includes(PASS), 'the passphrase is never in a job record');
  const seen = await watch(r.data.job.id), last = seen.at(-1);
  assert.equal(last.status, 'done'); assert.equal(last.ok, true); assert.equal(last.pct, 100); assert.equal(last.hasResult, true);
  assert.deepEqual(seen.map(j => j.pct), [...seen.map(j => j.pct)].sort((a, b) => a - b), 'progress only moves forward');
  assert.ok(seen.every(j => typeof j.step === 'string' && j.step.length > 0));
  const full = (await host.req('GET', `${JOBS}/${last.id}`)).data.job;
  assert.equal(full.result.ok, true); assert.ok(full.result.checks.some(c => /passphrase opens/.test(c.label)), 'the full test result is retrievable');
  assert.equal((await current()).job.id, last.id, 'the finished job stays until dismissed (the page survives a reload)');
  assert.equal((await host.req('GET', API)).data.job.id, last.id, 'the Backups page data carries the job');
  assert.equal((await host.req('POST', `${JOBS}/${last.id}/dismiss`)).data.ok, true); assert.equal((await current()).job, null);
  assert.equal((await host.req('GET', `${JOBS}/${last.id}`)).data.code, 'HOST_JOB_GONE');
});

test('a streamed full-site backup reports bytes, and a second job (or a second request of any kind) is refused while one runs', { skip: !sqlite && 'SQLite-only', timeout: 180000 }, async () => {
  await clear(); const id = (raw(srv.dir).prepare('SELECT id FROM accounts').get()).id; pad(srv.dir, id, 40);
  const a = await start('full-backup'); assert.equal(a.status, 202, JSON.stringify(a.data));
  const b = await start('test-restore', { name: 'x.db' }); assert.equal(b.status, 409); assert.equal(b.data.code, 'HOST_JOB_RUNNING'); assert.match(b.data.error, /only one runs at a time/i); assert.match(b.data.by, /Full-site backup/);
  assert.equal((await host.req('POST', `${API}/full/run`)).status, 409, 'the older one-request endpoint honours the same lock');
  assert.equal((await host.req('POST', `${API}/run/frequent`)).status, 409);
  const c = await start('bundle', { passphrase: PASS }); assert.equal(c.status, 409);
  assert.equal((await current()).busy, 'Full-site backup');
  const seen = await watch(a.data.job.id), last = seen.at(-1);
  assert.equal(last.status, 'done', JSON.stringify(last)); assert.match(last.summary, /Full-site backup myboxstock-fullsite-.*\.mbsbak made and verified/);
  assert.ok(seen.some(j => j.bytesTotal > 30e6 && j.bytesDone > 0), 'bytes of the file being written are reported');
  assert.ok(seen.some(j => /Writing the encrypted file/.test(j.step)) && seen.some(j => /check/i.test(j.step)), 'the steps are named: ' + [...new Set(seen.map(j => j.step))].join(' | '));
  const ok = await start('test-restore', { name: (await host.req('GET', API)).data.fullStatus.lastOk.name }); assert.equal(ok.status, 202, 'a new job is accepted once the first finished');
  await watch(ok.data.job.id); await clear();
});

test('failures are reported plainly: a short passphrase, a wrong token, a missing file, an unknown kind, a missing RESTORE', { skip: !sqlite && 'SQLite-only', timeout: 60000 }, async () => {
  await clear();
  let r = await start('bundle', { passphrase: 'short' }); assert.equal(r.status, 202); let j = (await watch(r.data.job.id)).at(-1);
  assert.equal(j.status, 'failed'); assert.equal(j.ok, false); assert.match(j.error.message, /at least 12 characters/); assert.equal((await current()).job.status, 'failed'); await clear();
  r = await start('file-restore', { token: 'nope', confirm: 'RESTORE' }); j = (await watch(r.data.job.id)).at(-1); assert.equal(j.status, 'failed'); assert.equal(j.error.code, 'HOST_BACKUP_COPY_NOT_TESTED'); await clear();
  assert.equal((await start('test-restore', { name: 'nope.db' })).status, 404);
  assert.equal((await start('nothing')).data.code, 'HOST_JOB_KIND');
  r = await start('restore', { name: 'x.db' }); assert.equal(r.status, 400); assert.equal(r.data.code, 'HOST_BACKUP_RESTORE_CONFIRM');
  assert.equal((await current()).job, null, 'a refused request does not leave a job behind');
  // a wrong passphrase is a test that did not pass (a result), not a failed job
  const name = (await host.req('GET', API)).data.fullStatus.lastOk.name; r = await start('test-restore', { name, passphrase: 'not the passphrase!!' }); j = (await watch(r.data.job.id)).at(-1);
  assert.equal(j.status, 'done'); assert.equal(j.ok, false); const res = (await host.req('GET', `${JOBS}/${j.id}`)).data.job.result; assert.equal(res.ok, false); assert.match(res.summary, /did not pass/); await clear();
});

test('a test whose sheet was closed (detached) drops its one-time token; a test that stays attached keeps it', { skip: !sqlite && 'SQLite-only', timeout: 120000 }, async () => {
  await clear(); const name = (await host.req('GET', API)).data.fullStatus.lastOk.name;
  let r = await start('file-test', { source: { folder: name }, passphrase: PASS }); assert.equal((await host.req('POST', `${JOBS}/${r.data.job.id}/detach`)).data.ok, true);
  let j = (await watch(r.data.job.id)).at(-1); assert.equal(j.ok, true); assert.equal((await host.req('GET', `${JOBS}/${j.id}`)).data.job.result.token, undefined, 'no token for a result nobody is waiting on'); await clear();
  r = await start('file-test', { source: { folder: name }, passphrase: PASS }); j = (await watch(r.data.job.id)).at(-1);
  const tok = (await host.req('GET', `${JOBS}/${j.id}`)).data.job.result.token; assert.ok(tok && tok.length >= 32); await clear();
  assert.equal((await host.req('DELETE', `${API}/file-test/token/${tok}`)).status, 200);
});

test('every job is in the audit trail (started, finished, failed) and no passphrase is logged', { skip: !sqlite && 'SQLite-only' }, async () => {
  await sleep(300); const log = allLogText(srv.logDir);
  assert.match(log, /backup\.job_started/); assert.match(log, /backup\.job_finished/); assert.match(log, /Background job FAILED: Full-site backup with a new passphrase/); assert.match(log, /Background job started: Test restore of/);
  assert.ok(!log.includes(PASS), 'the passphrase never reaches a log');
  const rows = readJsonl(srv.logDir, 'host').filter(l => /^backup\.job_/.test(l.event)); assert.ok(rows.length >= 8); assert.ok(rows.some(l => l.level === 'error'));
});

test('a restore job stages the restore, reports "restarting" and the server restarts; the job is in the audit trail', { skip: !sqlite && 'SQLite-only', timeout: 120000 }, async () => {
  await clear(); const snap = (await host.req('POST', `${API}`)).data.name; assert.ok(snap);
  const r = await start('restore', { name: snap, confirm: 'RESTORE' }); assert.equal(r.status, 202, JSON.stringify(r.data));
  const exited = new Promise(res => srv.proc.once('exit', res));
  let j; for (let i = 0; i < 400; i++) { try { j = (await current()).job; } catch { break; } if (j && j.status !== 'running') break; await sleep(20); }
  if (j) { assert.equal(j.status, 'done'); assert.equal(j.restarting, true); assert.match(j.summary, /restarting/); }
  await Promise.race([exited, sleep(10000)]); assert.notEqual(srv.proc.exitCode, null, 'the process exits so the supervisor can restart it');
  assert.match(allLogText(srv.logDir), /Restore of .* requested \(safety copy/);
});
