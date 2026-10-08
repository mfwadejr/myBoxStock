// TEST / backup-health — the Backups card data on the Host Overview and the five backup Alerts: each condition raises and clears, a healthy site raises nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client, sleep } from './helpers.mjs';
import { isSpaceLow } from '../src/services/backup/health.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const PW = 'Sup3rSecretPass!', DAY = 86400e3;
let srv, host;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
});
test.after(() => srv?.stop());
// Settings are changed straight in the database, as if time had passed.
function put(key, value) { const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); try { d.prepare('INSERT INTO settings (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at').run(key, JSON.stringify(value), Date.now()); } finally { d.close(); } }
const check = async () => (await host.req('POST', '/api/host/alerts/check')).data;
const open = async () => (await check()).open.filter(a => /^backup\.(nofull|destination|notest|space|job)$/.test(a.kind)).map(a => a.kind).sort();
const card = async () => (await host.req('GET', '/api/host/dashboard')).data.backupHealth;

test('a healthy site raises nothing and the card reports the facts', { skip: !sqlite && 'SQLite-only' }, async () => {
  assert.deepEqual(await open(), []);
  const h = await card(); assert.equal(h.protected, false); assert.equal(h.full.last, null); assert.equal(h.test.lastPass, null); assert.deepEqual(h.destinations, []); assert.ok(h.space.free > 0); assert.deepEqual(h.problems, []);
  put('backup_status', { frequent: { lastOk: { at: Date.now() - 3600e3, name: 'x.db', size: 5000 } }, offsite: {}, last: null });
  put('backup_full', { enabled: true, frequency: 'nightly' }); put('backup_full_status', { lastOk: { name: 'f.mbsbak', at: Date.now() - 3600e3, size: 9000, verified: true, destinations: [] }, lastFail: null });
  put('backup_test_last', { pass: { at: Date.now() - 2 * DAY, name: 'x.db', kind: 'snapshot' } });
  assert.deepEqual(await open(), []); const g = await card(); assert.equal(g.snapshot.size, 5000); assert.equal(g.full.last.size, 9000); assert.equal(g.test.lastPass.kind, 'snapshot'); assert.equal(g.full.late, false);
});

test('no full-site backup within the window raises and clears', { skip: !sqlite && 'SQLite-only' }, async () => {
  put('backup_full_status', { lastOk: { name: 'f.mbsbak', at: Date.now() - 3 * DAY, size: 9000, verified: true, destinations: [] }, lastFail: null });
  assert.deepEqual(await open(), ['backup.nofull']);
  const a = (await check()).open.find(x => x.kind === 'backup.nofull'); assert.match(a.detail, /Open Backups/); assert.equal(a.occurrences >= 2, true, 'grouped with a counter, not repeated');
  put('backup_full_status', { lastOk: { name: 'f.mbsbak', at: Date.now(), size: 9000, verified: true, destinations: [] }, lastFail: null });
  assert.deepEqual(await open(), []);
  put('backup_full', { enabled: true, frequency: 'weekly' }); put('backup_full_status', { lastOk: { name: 'f', at: Date.now() - 5 * DAY, size: 1, verified: true, destinations: [] }, lastFail: null });
  assert.deepEqual(await open(), [], 'a weekly schedule has an 8 day window');
  put('backup_full', { enabled: true, frequency: 'nightly' }); put('backup_full_status', { lastOk: { name: 'f', at: Date.now(), size: 9000, verified: true, destinations: [] }, lastFail: null });
});

test('a failing destination raises and clears', { skip: !sqlite && 'SQLite-only' }, async () => {
  const dest = (ok) => ({ id: 'd1', type: 'folder', name: 'NAS copy', enabled: true, settings: { path: '/tmp/none' }, secrets: {}, hostKey: '', lastTest: { at: Date.now() - 60e3, ok } });
  put('backup_destinations', [dest(false)]);
  assert.deepEqual(await open(), ['backup.destination']); const h = await card(); assert.equal(h.destinations[0].name, 'NAS copy'); assert.equal(h.destinations[0].failing, true);
  assert.match((await check()).open.find(a => a.kind === 'backup.destination').detail, /NAS copy/);
  put('backup_destinations', [dest(true)]); assert.deepEqual(await open(), []);
  put('backup_tiers', { offsite: { enabled: true, destinations: ['d1'] } }); put('backup_status', { frequent: { lastOk: { at: Date.now() - 3600e3, name: 'x.db', size: 5000 } }, offsite: { lastFail: { at: Date.now(), error: 'boom' } }, last: null });
  assert.deepEqual(await open(), ['backup.destination'], 'a failed send to it counts too');
  put('backup_status', { frequent: { lastOk: { at: Date.now() - 3600e3, name: 'x.db', size: 5000 } }, offsite: { lastOk: { at: Date.now(), where: [{ id: 'd1', name: 'NAS copy' }] } }, last: null });
  assert.deepEqual(await open(), []); assert.ok((await card()).destinations[0].lastSend);
  put('backup_destinations', []); put('backup_tiers', { offsite: { enabled: false, destinations: [] } });
});

test('no test restore within 30 days raises and clears; a failed test does not hide the last good one', { skip: !sqlite && 'SQLite-only' }, async () => {
  put('backup_test_last', { pass: { at: Date.now() - 31 * DAY, name: 'x.db', kind: 'snapshot' } });
  assert.deepEqual(await open(), ['backup.notest']);
  put('backup_test_last', { pass: { at: Date.now() - DAY, name: 'x.db', kind: 'snapshot' }, fail: { at: Date.now(), name: 'y.db', kind: 'snapshot' } });
  assert.deepEqual(await open(), []); const h = await card(); assert.ok(h.test.lastPass); assert.equal(h.test.lastFail.name, 'y.db');
});

test('a real Test restore is remembered, and a failed background job raises and clears', { skip: !sqlite && 'SQLite-only' }, async () => {
  const snap = await host.req('POST', '/api/host/backups', {}); const name = snap.data?.name || (await host.req('GET', '/api/host/backups')).data.backups?.[0]?.name;
  put('backup_test_last', {});
  if (name) {
    const r = await host.req('POST', '/api/host/backups/jobs', { kind: 'test-restore', name }); assert.equal(r.status, 202);
    for (let i = 0; i < 100; i++) { const c = await host.req('GET', '/api/host/backups/jobs/current'); if (c.data.job && c.data.job.status !== 'running') { await host.req('POST', `/api/host/backups/jobs/${c.data.job.id}/dismiss`); break; } await sleep(100); }
    const h = await card(); assert.equal(h.test.lastPass?.name, name, 'the test result is stored with its time');
  }
  const r = await host.req('POST', '/api/host/backups/jobs', { kind: 'file-restore', token: 'nope', confirm: 'RESTORE' }); assert.equal(r.status, 202);
  let id; for (let i = 0; i < 100; i++) { const c = await host.req('GET', '/api/host/backups/jobs/current'); if (c.data.job && c.data.job.status === 'failed') { id = c.data.job.id; break; } await sleep(100); }
  assert.ok(id, 'the job failed'); assert.ok((await open()).includes('backup.job'));
  await host.req('POST', `/api/host/backups/jobs/${id}/dismiss`); assert.ok(!(await open()).includes('backup.job'));
});

test('space: nearly full at 10% free or when two more copies would not fit', () => {
  assert.equal(isSpaceLow({ free: 50e9, total: 100e9 }, 1e9), false); assert.equal(isSpaceLow({ free: 4e9, total: 100e9 }), true);
  assert.equal(isSpaceLow({ free: 1.5e9, total: 100e9 }, 1e9), true); assert.equal(isSpaceLow({ free: null, total: null }, 1), false);
});
