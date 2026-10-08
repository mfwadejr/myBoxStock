// TEST / retention — Host > Data and retention: space numbers, each rule changes and persists, the audit floor, previews match deletions, typed confirmation,
// Owner-only changes, the audit trail surviving the log trim, audit entries about retention never pruned, compaction as a job, nightly pruning, support.viewed once a day.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, restartServer, Client, sleep } from './helpers.mjs';
import { totpCode } from '../src/auth/totp.mjs';

const PW = 'Sup3rSecretPass!', HELPER = 'H3lperSecretPass!', DAY = 86400000;
let srv, owner, helper, raw;
const api = (c, m, p, b) => c.req(m, '/api/host/retention' + p, b);
const open = () => new DatabaseSync(path.join(srv.dir, 'myboxstock.db'));
const q = (sql, ...p) => raw.prepare(sql).get(...p);
const ins = (id, ts, area, event, actor, msg = 'seed') => raw.prepare('INSERT INTO event_log (id, ts, level, area, event, actor, account_id, ip, message, raw) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, ts, 'info', area, event, actor, null, null, msg, '{"seed":true}');
async function entry(match) { for (let i = 0; i < 30; i++) { const rows = (await owner.req('GET', '/api/host/audit?type=retention')).data.rows || []; const hit = rows.find(match); if (hit) return hit; await sleep(200); } assert.fail('no audit entry'); }

test.before(async () => {
  srv = await startServer(); owner = new Client(srv.base);
  await owner.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await owner.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await owner.req('POST', '/api/host/admins', { username: 'helper', email: 'helper@example.com', password: 'Temp0rarySecret!' });
  helper = new Client(srv.base); await helper.req('POST', '/api/host/login', { login: 'helper', password: 'Temp0rarySecret!' }); await helper.req('POST', '/api/host/change-password', { current: 'Temp0rarySecret!', next: HELPER });
  const setup = await helper.req('POST', '/api/host/totp/setup'); await helper.req('POST', '/api/host/totp/enable', { code: totpCode(setup.data.secret) });
  raw = open();
});
test.after(() => { raw?.close(); srv?.stop(); });

test('space numbers are real and read-only for every administrator', async () => {
  fs.writeFileSync(path.join(srv.dir, 'x.bin'), 'x');
  const d = (await api(owner, 'GET', '')).data;
  assert.equal(d.isOwner, true); assert.ok(d.space.database.bytes > 50000, 'database size'); assert.ok(d.space.database.tables.some(t => t.name === 'event_log' && t.bytes > 0 && t.rows > 0), 'biggest tables');
  const onDisk = ['', '-wal'].reduce((a, s) => a + (fs.existsSync(path.join(srv.dir, 'myboxstock.db' + s)) ? fs.statSync(path.join(srv.dir, 'myboxstock.db' + s)).size : 0), 0);
  assert.ok(Math.abs(d.space.database.bytes - onDisk) < 400000, 'database size matches the file');
  assert.ok(d.space.logFiles.files > 0 && d.space.logFiles.bytes > 0); assert.ok(d.space.disk.free > 0 && d.space.disk.total >= d.space.disk.free);
  assert.equal(d.space.screenshots.count, 0); assert.equal(typeof d.space.backups.bytes, 'number'); assert.equal(typeof d.space.temp.count, 'number');
  assert.deepEqual([d.rules.logs.days, d.rules.audit.days, d.rules.tickets.days, d.rules.mail.days, d.rules.temp.days], [90, 0, 0, 30, 1], 'defaults: log 90 days, audit forever, tickets off');
  assert.deepEqual(d.rules.auto.kinds, { logs: true, audit: false, tickets: false, mail: true, temp: true });
  const h = (await api(helper, 'GET', '')).data; assert.equal(h.isOwner, false); assert.ok(h.space.database.bytes > 0, 'a helper can read');
});

test('only the Owner changes rules, prunes, compacts or changes automatic pruning; refusals are audited', async () => {
  for (const [m, p, b] of [['PUT', '/rules/mail', { days: 10 }], ['PUT', '/auto', { enabled: false }], ['POST', '/prune', { kind: 'mail', days: 1, confirm: 'PRUNE' }], ['POST', '/compact', {}]]) {
    const r = await api(helper, m, p, b); assert.equal(r.status, 403, p); assert.equal(r.data.code, 'RETENTION_OWNER_ONLY');
  }
  assert.equal((await api(owner, 'GET', '')).data.rules.mail.days, 30, 'nothing changed');
  await entry(r => r.event === 'retention.refused' && r.actor === 'helper');
});

test('each rule changes and persists across a restart; the audit floor of 1 year is enforced', async () => {
  for (const [k, days] of [['logs', 45], ['audit', 400], ['tickets', 60], ['mail', 14], ['temp', 3]]) { const r = await api(owner, 'PUT', `/rules/${k}`, { days }); assert.equal(r.status, 200, k); assert.equal(r.data.rules[k].days, days); }
  for (const bad of [100, 364, 1, -1, 1.5, 'abc']) { const r = await api(owner, 'PUT', '/rules/audit', { days: bad }); assert.equal(r.status, 400, String(bad)); }
  assert.equal((await api(owner, 'PUT', '/rules/audit', { days: 100 })).data.code, 'RETENTION_AUDIT_FLOOR');
  assert.equal((await api(owner, 'PUT', '/rules/logs', { days: 3 })).status, 400); assert.equal((await api(owner, 'PUT', '/rules/mail', { days: 0 })).status, 400); assert.equal((await api(owner, 'PUT', '/rules/nope', { days: 5 })).data.code, 'RETENTION_KIND');
  assert.equal((await api(owner, 'PUT', '/rules/audit', { days: 365 })).status, 200, 'exactly one year is allowed'); assert.equal((await api(owner, 'PUT', '/rules/audit', { days: 400 })).status, 200);
  const e = await entry(r => r.event === 'retention.rule' && /audit trail changed from/.test(r.message)); assert.equal(e.actor, 'admin'); assert.equal(e.label, 'Retention rule changed');
  raw.close(); srv = await restartServer(srv); owner = new Client(srv.base); await owner.req('POST', '/api/host/login', { login: 'admin', password: PW }); helper.base = srv.base; raw = open();
  const r = (await api(owner, 'GET', '')).data.rules; assert.deepEqual([r.logs.days, r.audit.days, r.tickets.days, r.mail.days, r.temp.days], [45, 400, 60, 14, 3]);
  await api(owner, 'PUT', '/rules/audit', { days: 0 }); assert.equal((await api(owner, 'GET', '')).data.rules.audit.days, 0, 'zero is forever');
});

test('the log trim keeps the audit trail; old audit rows survive; retention entries are never pruned', async () => {
  const old = Date.now() - 800 * DAY;
  ins('o-log1', old, 'tenant', 'sale.created', null); ins('o-log2', old, 'mail', 'sent', null); ins('o-log3', old, 'host', 'noise', null);
  ins('o-aud1', old, 'host', 'settings.changed', 'admin', 'Old setting change'); ins('o-aud2', old, 'security', 'rule.added', 'admin'); ins('o-ret1', old, 'host', 'retention.rule', 'admin', 'Old retention change'); ins('o-ret2', old, 'host', 'retention.pruned', 'System');
  const pv = (await api(owner, 'GET', '/preview?kind=logs&days=90')).data;
  const expected = q("SELECT COUNT(*) n FROM event_log WHERE ts < ? AND id IN ('o-log1','o-log2','o-log3')", Date.now() - 90 * DAY).n; assert.equal(expected, 3);
  assert.ok(pv.count >= 3 && pv.bytes > 0 && pv.oldest <= old);
  const before = q('SELECT COUNT(*) n FROM event_log').n, r = await api(owner, 'POST', '/prune', { kind: 'logs', days: 90, confirm: 'PRUNE' });
  assert.equal(r.status, 200); assert.equal(r.data.count, pv.count, 'the preview count is what was deleted');
  assert.equal(q('SELECT COUNT(*) n FROM event_log').n - before, -pv.count + q("SELECT COUNT(*) n FROM event_log WHERE event = 'retention.pruned' AND ts > ?", Date.now() - 20000).n, 'only the previewed rows went (plus the new audit entry)');
  for (const id of ['o-log1', 'o-log2', 'o-log3']) assert.equal(q('SELECT 1 x FROM event_log WHERE id = ?', id), undefined, id);
  for (const id of ['o-aud1', 'o-aud2', 'o-ret1', 'o-ret2']) assert.ok(q('SELECT 1 x FROM event_log WHERE id = ?', id), 'kept ' + id);
  // the audit prune: needs an age of 365 or more, never takes retention entries
  assert.equal((await api(owner, 'GET', '/preview?kind=audit&days=30')).status, 400, 'below the floor'); assert.equal((await api(owner, 'GET', '/preview?kind=audit')).status, 400, 'forever has no age');
  const ap = (await api(owner, 'GET', '/preview?kind=audit&days=500')).data; assert.equal(ap.count, 2, 'two old audit rows, not the retention ones');
  assert.equal((await api(owner, 'POST', '/prune', { kind: 'audit', days: 500, confirm: 'PRUNE' })).data.count, 2);
  assert.equal(q("SELECT 1 x FROM event_log WHERE id = 'o-aud1'"), undefined); for (const id of ['o-ret1', 'o-ret2']) assert.ok(q('SELECT 1 x FROM event_log WHERE id = ?', id), 'retention entries never pruned: ' + id);
  const e = await entry(r => r.event === 'retention.pruned' && r.actor === 'admin' && /audit trail/.test(r.message)); assert.match(e.message, /removed 2 audit-trail rows/);
});

test('typed confirmation is required and previews match deletions for tickets, mail and temporary files', async () => {
  const old = Date.now() - 200 * DAY, now = Date.now();
  for (const [i, t] of [[1, old], [2, old], [3, now - DAY]]) {
    raw.prepare("INSERT INTO support_tickets (id, number, source, subject, category, priority, status, created_at, updated_at, closed_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run('t' + i, 9000 + i, 'app', 'subject', 'Question', 'Normal', 'closed', t, t, t);
    raw.prepare("INSERT INTO support_messages (id, ticket_id, ts, side, body) VALUES (?,?,?,?,?)").run('m' + i, 't' + i, t, 'requester', 'hello ' + i);
  }
  raw.prepare("INSERT INTO support_tickets (id, number, source, subject, category, priority, status, created_at, updated_at) VALUES ('t4', 9004, 'app', 's', 'Question', 'Normal', 'open', ?, ?)").run(old, old);
  raw.prepare("INSERT INTO support_attachments (id, ticket_id, owner_kind, owner_id, name, mime, size, data, created_at) VALUES ('a1','t1','reseller','x','s.png','image/png',1234,'AAAA',?)").run(old);
  for (const [i, st, t] of [[1, 'sent', old], [2, 'failed', old], [3, 'queued', old], [4, 'sent', now]]) raw.prepare('INSERT INTO mail_queue (id, to_addr, subject, body_text, status, attempts, created_at, sent_at) VALUES (?,?,?,?,?,0,?,?)').run('q' + i, 'a@b.c', 'sub', 'body', st, t, st === 'sent' ? t : null);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-retention-test-')), fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-retention-fresh-')); fs.writeFileSync(path.join(tmp, 'f'), 'z'.repeat(5000)); fs.utimesSync(tmp, new Date(old), new Date(old));
  try {
    const pt = (await api(owner, 'GET', '/preview?kind=tickets&days=90')).data; assert.equal(pt.count, 2); assert.match(pt.detail, /2 messages, 1 screenshots/); assert.ok(pt.bytes >= 1234);
    const pm = (await api(owner, 'GET', '/preview?kind=mail&days=30')).data; assert.equal(pm.count, 2, 'sent and failed, not queued, not new');
    const pf = (await api(owner, 'GET', '/preview?kind=temp&days=3')).data; assert.ok(pf.count >= 1 && pf.bytes >= 5000);
    for (const k of ['tickets', 'mail', 'temp']) for (const confirm of [undefined, '', 'prune', 'PURGE']) { const r = await api(owner, 'POST', '/prune', { kind: k, days: 3, confirm }); assert.equal(r.status, 400, k); assert.equal(r.data.code, 'RETENTION_CONFIRM'); }
    assert.equal(q('SELECT COUNT(*) n FROM support_tickets').n, 4, 'nothing deleted without the typed word'); assert.ok(fs.existsSync(tmp));
    let r = (await api(owner, 'POST', '/prune', { kind: 'tickets', days: 90, confirm: 'PRUNE' })).data; assert.equal(r.count, pt.count);
    assert.deepEqual([q('SELECT COUNT(*) n FROM support_tickets').n, q('SELECT COUNT(*) n FROM support_messages').n, q('SELECT COUNT(*) n FROM support_attachments').n], [2, 1, 0], 'old closed tickets, their messages and screenshots; the open and the recent one stay');
    r = (await api(owner, 'POST', '/prune', { kind: 'mail', days: 30, confirm: 'PRUNE' })).data; assert.equal(r.count, pm.count); assert.deepEqual(raw.prepare('SELECT id FROM mail_queue ORDER BY id').all().map(x => x.id), ['q3', 'q4']);
    r = (await api(owner, 'POST', '/prune', { kind: 'temp', days: 3, confirm: 'PRUNE' })).data; assert.ok(r.count >= 1); assert.ok(!fs.existsSync(tmp), 'old scratch folder removed'); assert.ok(fs.existsSync(fresh), 'a fresh one stays');
    const e = await entry(r => r.event === 'retention.pruned' && /closed support tickets/.test(r.message)); assert.equal(e.actor, 'admin'); assert.match(e.message, /removed 2 closed tickets/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(fresh, { recursive: true, force: true }); }
});

test('compaction frees space and runs as a background job, one at a time', async () => {
  const pad = 'p'.repeat(2000), ins2 = raw.prepare('INSERT INTO event_log (id, ts, level, area, event, actor, message, raw) VALUES (?,?,?,?,?,?,?,?)');
  raw.exec('BEGIN'); for (let i = 0; i < 6000; i++) ins2.run('big' + i, 1000 + i, 'info', 'mail', 'sent', null, pad, pad); raw.exec('COMMIT');
  await api(owner, 'PUT', '/rules/logs', { days: 7 });
  const big = (await api(owner, 'GET', '')).data.space.database.bytes; assert.ok(big > 10e6);
  assert.equal((await api(owner, 'POST', '/prune', { kind: 'logs', days: 7, confirm: 'PRUNE' })).status, 200);
  const mid = (await api(owner, 'GET', '')).data; assert.ok(mid.space.database.reclaimable > 5e6, 'deleted rows left free space in the file');
  const r = await api(owner, 'POST', '/compact', {}); assert.equal(r.status, 202); assert.equal(r.data.job.kind, 'compact'); assert.equal(r.data.job.label, 'Compact the database');
  const again = await api(owner, 'POST', '/compact', {}); if (again.status !== 202) { assert.equal(again.status, 409); assert.equal(again.data.code, 'HOST_JOB_RUNNING'); }
  let job; for (let i = 0; i < 100; i++) { job = (await owner.req('GET', '/api/host/backups/jobs/current')).data.job; if (job && job.status !== 'running') break; await sleep(200); }
  assert.equal(job.status, 'done'); assert.equal(job.ok, true); assert.match(job.summary, /Compacted/);
  const after = (await api(owner, 'GET', '')).data.space.database; assert.ok(after.bytes < big - 5e6, `file shrank (${big} -> ${after.bytes})`); assert.ok(after.reclaimable < 1e6);
  const e = await entry(r => r.event === 'retention.compacted'); assert.equal(e.actor, 'admin'); assert.match(e.message, /freed about/);
});

test('automatic pruning is configurable per row (Owner only) and audited', async () => {
  let r = await api(owner, 'PUT', '/auto', { enabled: true, hour: 4, kinds: { audit: true, mail: false } }); assert.equal(r.status, 200); assert.deepEqual([r.data.rules.auto.hour, r.data.rules.auto.kinds.audit, r.data.rules.auto.kinds.mail], [4, true, false]);
  assert.equal((await api(owner, 'PUT', '/auto', { hour: 24 })).status, 400); assert.equal((await api(owner, 'PUT', '/auto', { kinds: { nope: true } })).data.code, 'RETENTION_KIND');
  const e = await entry(r => r.event === 'retention.auto'); assert.match(e.message, /hour 4:00/); assert.equal(e.label, 'Automatic pruning changed');
  await api(owner, 'PUT', '/auto', { hour: 3, kinds: { audit: false, mail: true } });
});

test('support.viewed is logged once per administrator per ticket per day; every real action every time', async () => {
  raw.prepare("INSERT INTO support_tickets (id, number, source, account_id, subject, category, priority, status, created_at, updated_at) VALUES ('tv', 9100, 'app', NULL, 's', 'Question', 'Normal', 'open', ?, ?)").run(Date.now(), Date.now());
  raw.prepare("INSERT INTO support_tickets (id, number, source, account_id, subject, category, priority, status, created_at, updated_at) VALUES ('tw', 9101, 'app', NULL, 's', 'Question', 'Normal', 'open', ?, ?)").run(Date.now(), Date.now());
  for (let i = 0; i < 4; i++) assert.equal((await owner.req('GET', '/api/host/support/tickets/9100')).status, 200);
  await owner.req('GET', '/api/host/support/tickets/9101'); for (let i = 0; i < 2; i++) assert.equal((await helper.req('GET', '/api/host/support/tickets/9100')).status, 200);
  for (let i = 0; i < 3; i++) { assert.equal((await owner.req('POST', '/api/host/support/tickets/9100/reply', { message: 'note ' + i, internal: true })).status, 200); }
  await sleep(1200);
  const cnt = (m) => q("SELECT COUNT(*) n FROM event_log WHERE event = ? AND actor = 'admin' AND message LIKE ?", m[0], m[1]).n;
  assert.equal(cnt(['support.viewed', '%T-9100%']), 1, 'four views, one entry'); assert.equal(cnt(['support.viewed', '%T-9101%']), 1, 'another ticket gets its own');
  assert.equal(cnt(['support.note', '%T-9100%']), 3, 'every note is logged');
  assert.equal(q("SELECT COUNT(*) n FROM event_log WHERE event = 'support.viewed' AND actor = 'helper'").n, 1, 'each administrator has their own first view');
  raw.close(); srv = await restartServer(srv); owner = new Client(srv.base); await owner.req('POST', '/api/host/login', { login: 'admin', password: PW }); helper.base = srv.base; raw = open();
  assert.equal((await owner.req('GET', '/api/host/support/tickets/9100')).status, 200); await sleep(1200);
  assert.equal(cnt(['support.viewed', '%T-9100%']), 1, 'a restart does not make it log again the same day');
});

test('the nightly run prunes the rows switched on, writes System entries, and leaves manual rows and the audit trail alone', async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-nightly-'));
  const { initDb } = await import('../src/db/connection.mjs'), L = await import('../src/logging/logger.mjs'), R = await import('../src/services/retention/index.mjs');
  const db = await initDb({ file: path.join(process.env.DATA_DIR, 'n.db') }); L.attachLogDb(db);
  const old = Date.now() - 400 * DAY, add = (id, area, ev, actor) => db.run('INSERT INTO event_log (id, ts, level, area, event, actor, message, raw) VALUES (?,?,?,?,?,?,?,?)', [id, old, 'info', area, ev, actor, 'm', 'r']);
  await add('n1', 'mail', 'sent', null); await add('n2', 'host', 'x.changed', 'admin');
  await db.run("INSERT INTO mail_queue (id, to_addr, subject, status, attempts, created_at, sent_at) VALUES ('nm','a@b.c','s','sent',0,?,?)", [old, old]);
  await db.run("INSERT INTO support_tickets (id, number, source, subject, category, priority, status, created_at, updated_at, closed_at) VALUES ('nt', 1, 'app', 's', 'Q', 'N', 'closed', ?, ?, ?)", [old, old, old]);
  const at = (h) => new Date(2030, 0, 5, h, 0, 0).getTime();
  assert.equal(await R.runNightly(db, at(1)), null, 'before the hour nothing runs');
  const done = await R.runNightly(db, at(4)); await L.flush();
  assert.deepEqual(done.filter(x => x.count).map(x => x.kind).sort(), ['logs', 'mail'], 'logs and mail by default; tickets and audit are manual; temp had nothing');
  assert.equal(await db.get("SELECT 1 x FROM event_log WHERE id = 'n1'"), undefined); assert.ok(await db.get("SELECT 1 x FROM event_log WHERE id = 'n2'"), 'audit row kept'); assert.ok(await db.get("SELECT 1 x FROM support_tickets WHERE id = 'nt'"), 'tickets are manual');
  const e = await db.all("SELECT actor, message FROM event_log WHERE event = 'retention.pruned'"); assert.ok(e.length >= 2 && e.every(x => x.actor === 'System' && /Automatic prune/.test(x.message)));
  assert.equal(await R.runNightly(db, at(5)), null, 'once a day');
  await R.saveRulePart(db, 'auto', { enabled: true, hour: 3, kinds: { logs: false, audit: false, tickets: true, mail: false, temp: false } }); await R.saveRulePart(db, 'tickets', { days: 30 });
  const next = await R.runNightly(db, new Date(2030, 0, 6, 4).getTime()); assert.deepEqual(next.map(x => x.kind), ['tickets']); assert.equal(await db.get("SELECT 1 x FROM support_tickets WHERE id = 'nt'"), undefined);
  await R.saveRulePart(db, 'auto', { enabled: false, hour: 3, kinds: {} }); assert.equal(await R.runNightly(db, new Date(2030, 0, 7, 4).getTime()), null, 'switched off');
  await db.close();
});
