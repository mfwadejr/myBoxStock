// TEST / t38-demo-service — Demo mode's engine without a server: the generator builds the right counts and logins, the records open with the app's own vault code, the same seed gives
// the same data, real accounts are never touched (snapshot before and after Build, Remove, Reset), name clashes and size and disk limits refuse before anything is written, a stop leaves
// whole accounts, passwords reset cleanly, backups leave demo out of the copy, and demo addresses never get mail.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't38-')); process.env.DATA_DIR = dir; process.env.LOG_DIR = path.join(dir, 'logs');
const { initDb } = await import('../src/db/connection.mjs');
const demo = await import('../src/services/demo/index.mjs');
const { demoVault } = await import('../src/services/demo/vault.mjs');
const { enqueueMail } = await import('../src/services/mail/index.mjs');
const { setSetting } = await import('../src/db/settings.mjs');
const { hashPassword, verifyPassword } = await import('../src/auth/password.mjs');
const V = demoVault();
const ANCHOR = Date.UTC(2026, 9, 1);

let n = 0;
const fresh = async () => { const file = path.join(dir, `db${++n}.db`); return initDb({ file }); };
// A tiny custom set: a few accounts with a handful of devices, so most checks take milliseconds.
const tiny = async (db, name = 'Tiny', over = {}) => demo.saveSet(db, '', { name, accounts: 4, devices: { min: 3, max: 12, big: 1 }, team: { min: 1, max: 2 }, customersPer100Sold: 60, seed: 7, ...over }, { create: true });

// A real account with a user, keys and records, written straight into the tables, plus a real setting and a plan.
async function seedReal(db) {
  const t = Date.now();
  await db.run("INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at, demo) VALUES ('real1','amber-fox-4271','Real Reseller','real@example.com','active','paid',?,0)", [t]);
  await db.run("INSERT INTO account_users (id, account_id, login, username, email, role, pw_hash, created_at) VALUES ('ru1','real1','boss@amber-fox-4271','boss','real@example.com','Administrator',?,?)", [hashPassword('Real-Password-1'), t]);
  await db.run("INSERT INTO account_keys (user_id, account_id, salt, iters, wrapped_adk, updated_at) VALUES ('ru1','real1','salt','600000','v1.aaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbb',?)", [t]);
  await db.run("INSERT INTO account_recovery (account_id, wrapped_adk, created_at) VALUES ('real1','v1.aaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbb',?)", [t]);
  for (let i = 0; i < 5; i++) await db.run("INSERT INTO records (id, account_id, type, blob, rev, created_at, updated_at) VALUES (?, 'real1','item','v1.abcdefgh.ijklmnopqrstuvwxyz0123',1,?,?)", [`realrec-${i}-aaaa`, t, t]);
  await db.run("INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at, demo) VALUES ('real2','blue-owl-9999','Another Real','r2@example.com','active','trial',?,0)", [t]);
  await setSetting(db, 'plans', [{ id: 'p1', name: 'Pro', priceCents: 2900, interval: 'month', maxUsers: 5, maxDevices: 500, note: '' }]);
  await setSetting(db, 'mail_templates', { welcome: { subject: 'Hi' } });
}
// Every row that is not demo, as text, so before and after can be compared exactly. Logs and the Demo mode settings entry are the only things allowed to change.
async function snapshot(db) {
  const out = {}, real = (await db.all('SELECT id FROM accounts WHERE demo = 0')).map(r => r.id), q = real.map(() => '?').join(',') || "''";
  out.accounts = await db.all('SELECT * FROM accounts WHERE demo = 0 ORDER BY id');
  for (const t of ['account_users', 'account_keys', 'account_recovery', 'account_roles', 'records', 'billing_events', 'billing_receipts', 'sign_in_history', 'restore_points', 'restore_point_records', 'inventory_items']) out[t] = await db.all(`SELECT * FROM ${t} WHERE account_id IN (${q}) ORDER BY 1, 2`, real);
  out.settings = await db.all("SELECT k, v FROM settings WHERE k <> 'demo_mode' ORDER BY k");
  for (const t of ['host_admins', 'firewall_rules', 'mail_queue', 'alerts', 'support_tickets']) out[t] = await db.all(`SELECT * FROM ${t} ORDER BY 1`);
  return JSON.stringify(out);
}

test('a custom set builds the right counts, named logins and encrypted records the real vault can open', async () => {
  const db = await fresh(), set = await tiny(db);
  const out = await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR });
  assert.equal(out.accounts, 4); assert.equal(out.stopped, false);
  const a = await db.all('SELECT * FROM accounts WHERE demo = 1 ORDER BY account_code');
  assert.equal(a.length, 4); assert.ok(a.every(x => x.demo === 1 && x.demo_set === 'tiny' && x.status === 'active'));
  assert.deepEqual(a.map(x => x.account_code), ['tiny-001', 'tiny-002', 'tiny-003', 'tiny-004']); assert.equal(a[0].business_name, 'Tiny');
  assert.ok(a.every(x => ['trial', 'free', 'paid'].includes(x.plan)), 'plan mix is trial, free or paid (no plan list is created)');
  // people: the first account has the named Owner, Standard and View logins; everyone is on the reserved demo domain
  const first = await db.all('SELECT login, role, email FROM account_users WHERE account_id = ? ORDER BY login', [a[0].id]);
  for (const l of ['tiny@tiny-001', 'tiny-std@tiny-001', 'tiny-view@tiny-001']) assert.ok(first.some(u => u.login === l), l);
  assert.equal(first.find(u => u.login === 'tiny@tiny-001').role, 'Administrator'); assert.equal(first.find(u => u.login === 'tiny-std@tiny-001').role, 'Standard'); assert.equal(first.find(u => u.login === 'tiny-view@tiny-001').role, 'View');
  assert.ok((await db.all('SELECT email FROM account_users WHERE account_id IN (SELECT id FROM accounts WHERE demo = 1)')).every(u => u.email.endsWith('@demo.myboxstock.invalid')));
  const per = await db.all('SELECT account_id, COUNT(*) n FROM account_users GROUP BY account_id'); assert.ok(per.every(p => p.n >= 2 && p.n <= 4), 'owner plus 1 to 2 team members (3 and up for the named account)');
  assert.equal((await db.all('SELECT * FROM demo_logins WHERE kind <> ?', ['filler'])).length, 3, 'one row per named login');
  // the records open with the app's own vault code, using the real password of each named login
  for (const [kind, login] of [['owner', 'tiny@tiny-001'], ['std', 'tiny-std@tiny-001'], ['view', 'tiny-view@tiny-001']]) {
    const u = await db.get('SELECT id FROM account_users WHERE login = ?', [login]), pw = (await demo.passwordOf(db, u.id)).password, k = await db.get('SELECT salt, iters, wrapped_adk FROM account_keys WHERE user_id = ?', [u.id]);
    assert.ok(verifyPassword(pw, (await db.get('SELECT pw_hash FROM account_users WHERE id = ?', [u.id])).pw_hash), kind + ' password matches its sign-in hash');
    const adk = await V.unlock(pw, { salt: k.salt, iters: Number(k.iters), wrappedAdk: k.wrapped_adk }), rows = await db.all('SELECT id, type, blob FROM records WHERE account_id = ?', [a[0].id]);
    const opened = []; for (const r of rows) opened.push({ type: r.type, d: await V.open(adk, r.blob, r.id, r.type) });
    assert.ok(opened.some(o => o.type === 'item' && o.d.uid && o.d.make) && opened.some(o => o.type === 'model'), kind + ' opens devices and models');
  }
  // a sold device points at a sale that lists it, in the shape the sell screen writes
  const u = await db.get("SELECT id FROM account_users WHERE login = 'tiny@tiny-001'"), pw = (await demo.passwordOf(db, u.id)).password, k = await db.get('SELECT salt, iters, wrapped_adk FROM account_keys WHERE user_id = ?', [u.id]);
  const adk = await V.unlock(pw, { salt: k.salt, iters: Number(k.iters), wrappedAdk: k.wrapped_adk }), all = []; for (const r of await db.all('SELECT id, type, blob FROM records WHERE account_id = ?', [a[0].id])) all.push({ id: r.id, type: r.type, d: await V.open(adk, r.blob, r.id, r.type) });
  const sales = all.filter(x => x.type === 'sale'), sold = all.filter(x => x.type === 'item' && x.d.status === 'sold');
  assert.ok(sales.length > 0 && sold.length > 0, 'sales exist');
  for (const s of sold) { const sale = sales.find(x => x.id === s.d.saleId); assert.ok(sale && sale.d.items.some(i => i.id === s.id), 'the sale lists the device'); }
  for (const s of sales) { assert.match(s.d.no, /^S-\d{8}-[A-Z0-9]{5}$/); assert.equal(s.d.total, s.d.items.reduce((t, i) => t + i.price, 0)); assert.ok(s.d.ts <= Date.now()); }
  // a record cannot be swapped for another: the id and type are bound into the ciphertext
  const any = (await db.all('SELECT id, type, blob FROM records WHERE account_id = ? LIMIT 1', [a[0].id]))[0]; await assert.rejects(() => V.open(adk, any.blob, 'other-id-value', any.type));
});

test('Demo3 builds in seconds with the default sizes, and the same seed makes identical data', async () => {
  const dbA = await fresh(), dbB = await fresh(), t0 = Date.now();
  const a = await demo.buildSet(dbA, 'demo3', { requireOn: false, anchor: ANCHOR });
  assert.ok(Date.now() - t0 < 20000, `Demo3 took ${Date.now() - t0} ms`);
  assert.equal(a.accounts, 3); assert.ok(a.users >= 7 && a.users <= 12); assert.ok(a.devices >= 3 * 20 && a.devices <= 3 * 500);
  assert.deepEqual((await dbA.all('SELECT login, role FROM demo_logins WHERE kind <> ? ORDER BY login', ['filler'])).map(x => x.login), ['demo3-std@demo3-001', 'demo3-view@demo3-001', 'demo3@demo3-001']);
  const largest = Math.max(...(await dbA.all("SELECT account_id, COUNT(*) n FROM records WHERE type = 'item' GROUP BY account_id")).map(r => r.n)); assert.ok(largest >= 140, 'a big account exists even in a set of three');
  await demo.buildSet(dbB, 'demo3', { requireOn: false, anchor: ANCHOR });
  // identical plaintext: same account codes, same record ids, same decrypted content (the ciphertext differs: every build has fresh keys)
  const plain = async (db) => {
    const out = {}; for (const a of await db.all('SELECT id, account_code FROM accounts ORDER BY account_code')) {
      const u = await db.get('SELECT id FROM account_users WHERE account_id = ? AND role = ? ORDER BY created_at, login LIMIT 1', [a.id, 'Administrator']), k = await db.get('SELECT salt, iters, wrapped_adk FROM account_keys WHERE user_id = ?', [u.id]);
      const pws = []; for (const l of await db.all('SELECT user_id FROM demo_logins WHERE set_key = ? AND kind IN (?, ?)', ['demo3', 'owner', 'filler'])) pws.push((await demo.passwordOf(db, l.user_id)).password);
      let pw = null; for (const c of pws) { try { await V.unlock(c, { salt: k.salt, iters: Number(k.iters), wrappedAdk: k.wrapped_adk }); pw = c; break; } catch { /* try the next */ } }
      assert.ok(pw, 'one of the set passwords opens every account');
      const adk = await V.unlock(pw, { salt: k.salt, iters: Number(k.iters), wrappedAdk: k.wrapped_adk }); const recs = {};
      for (const r of await db.all('SELECT id, type, blob FROM records WHERE account_id = ? ORDER BY id', [a.id])) recs[r.id] = JSON.stringify(await V.open(adk, r.blob, r.id, r.type));
      out[a.account_code] = recs;
    } return out;
  };
  assert.deepEqual(await plain(dbA), await plain(dbB), 'same seed, same data');
  const dbC = await fresh(); await demo.saveSet(dbC, 'demo3', { seed: 99 }); await demo.buildSet(dbC, 'demo3', { requireOn: false, anchor: ANCHOR });
  assert.notEqual((await dbC.get('SELECT COUNT(*) n FROM records')).n + ':' + (await dbC.get("SELECT SUM(LENGTH(blob)) s FROM records")).s, (await dbA.get('SELECT COUNT(*) n FROM records')).n + ':' + (await dbA.get("SELECT SUM(LENGTH(blob)) s FROM records")).s, 'a different seed changes the data');
});

test('real accounts and their data are identical before and after Build, Remove and Reset', async () => {
  const db = await fresh(); await seedReal(db); const before = await snapshot(db);
  const set = await tiny(db, 'Snap');
  await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR }); assert.equal(await snapshot(db), before, 'after Build');
  assert.equal((await db.get('SELECT COUNT(*) n FROM accounts WHERE demo = 0')).n, 2);
  const gone = await demo.removeAccounts(db, { set: 'snap' }); assert.equal(gone.accounts, 4); assert.equal(await snapshot(db), before, 'after Remove');
  await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR }); await demo.removeAccounts(db, {}); await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR + 1000 }); assert.equal(await snapshot(db), before, 'after Remove and a rebuild (Reset demo)');
  assert.equal((await db.get('SELECT COUNT(*) n FROM records WHERE account_id = ?', ['real1'])).n, 5);
  // the removal also leaves nothing of the demo behind
  await demo.removeAccounts(db, {});
  for (const t of ['account_users', 'account_keys', 'account_recovery', 'account_roles', 'records', 'demo_logins']) assert.equal((await db.get(`SELECT COUNT(*) n FROM ${t} WHERE account_id NOT IN (SELECT id FROM accounts)`)).n, 0, t + ' has no orphans');
  assert.equal((await db.get('SELECT COUNT(*) n FROM demo_logins')).n, 0); assert.equal((await db.get('SELECT COUNT(*) n FROM account_users WHERE login LIKE ?', ['%snap%'])).n, 0);
  assert.equal(await snapshot(db), before, 'after the last Remove');
});

test('Remove selects only the demo tag: a real account with a demo-looking name is never removed', async () => {
  const db = await fresh(); await seedReal(db);
  await db.run("INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at, demo, demo_set) VALUES ('look','tiny-777','Tiny','x@example.com','active','free',?,0,'tiny')", [Date.now()]);
  const set = await tiny(db, 'Other'); await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR });
  const p = await demo.previewRemove(db, null); assert.equal(p.accounts, 4); assert.equal(p.realAccounts, 3);
  await demo.removeAccounts(db, {}); assert.ok(await db.get("SELECT id FROM accounts WHERE id = 'look'"), 'a row with demo = 0 stays, whatever it is called or whichever set it claims');
  assert.ok(await db.get("SELECT id FROM accounts WHERE id = 'real1'"));
});

test('a real reseller with a clashing name, Reseller ID or sign-in makes Build refuse before anything is written', async () => {
  for (const [label, sql, args] of [
    ['business name', "INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at, demo) VALUES ('c1','amber-fox-1111','Demo3','x@example.com','active','free',?,0)", [Date.now()]],
    ['business name prefix', "INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at, demo) VALUES ('c1','amber-fox-1111','demo3 Streaming Ltd','x@example.com','active','free',?,0)", [Date.now()]],
    ['Reseller ID', "INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at, demo) VALUES ('c1','demo3-001','Some Business','x@example.com','active','free',?,0)", [Date.now()]],
  ]) {
    const db = await fresh(); await seedReal(db); await db.run(sql, args); const before = await snapshot(db);
    await assert.rejects(() => demo.buildSet(db, 'demo3', { requireOn: false, anchor: ANCHOR }), (e) => e.code === 'DEMO_NAME_CLASH' && e.clashes.length >= 1, label);
    assert.equal((await db.get('SELECT COUNT(*) n FROM accounts WHERE demo = 1')).n, 0, label + ': nothing was built'); assert.equal(await snapshot(db), before);
  }
  const db = await fresh(); await seedReal(db);
  await db.run("INSERT INTO account_users (id, account_id, login, username, email, role, pw_hash, created_at) VALUES ('ru2','real2','demo3@blue-owl-9999','demo3','a@example.com','Administrator','x',?)", [Date.now()]);
  await assert.rejects(() => demo.buildSet(db, 'demo3', { requireOn: false }), (e) => e.code === 'DEMO_NAME_CLASH', 'a real sign-in called demo3');
  // the other sets are not blocked by it
  const clean = await fresh(); await seedReal(clean); assert.deepEqual(await demo.nameClashes(clean, (await demo.getDemo(clean)).sets[0]), []);
});

test('a set that is already built, demo mode off, too many records and too little disk are all refused', async () => {
  const db = await fresh(), set = await tiny(db, 'Guard');
  await assert.rejects(() => demo.buildSet(db, set.key, { anchor: ANCHOR }), (e) => e.code === 'DEMO_OFF', 'Demo mode is off by default');
  await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR });
  await assert.rejects(() => demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR }), (e) => e.code === 'DEMO_ALREADY_BUILT');
  await assert.rejects(() => demo.buildSet(db, 'nope', { requireOn: false }), (e) => e.code === 'DEMO_SET_UNKNOWN');
  const big = await tiny(db, 'Huge', { accounts: 50, devices: { min: 100, max: 400, big: 2 } }); await demo.saveOptions(db, { limits: { records: 1000 } });
  await assert.rejects(() => demo.buildSet(db, big.key, { requireOn: false, anchor: ANCHOR }), (e) => e.code === 'DEMO_TOO_BIG' && e.estimate.records > 1000);
  await demo.saveOptions(db, { limits: { records: 6000000, devicesPerAccount: 50 } }); await assert.rejects(() => demo.buildSet(db, big.key, { requireOn: false, anchor: ANCHOR }), (e) => e.code === 'DEMO_TOO_BIG', 'an account larger than the per-account limit');
  await assert.rejects(() => demo.saveSet(db, big.key, { devices: { min: 1, max: 99999 } }), (e) => e.code === 'DEMO_SETTINGS_BAD', 'a set cannot ask for more than the hard maximum');
  await demo.saveOptions(db, { limits: { devicesPerAccount: 5000 } });
  await assert.rejects(() => demo.buildSet(db, big.key, { requireOn: false, anchor: ANCHOR, freeBytes: 10 * 1048576 }), (e) => e.code === 'DEMO_DISK' && e.free === 10 * 1048576, 'free disk is checked against the estimate');
  assert.equal((await db.get("SELECT COUNT(*) n FROM accounts WHERE demo_set = 'huge'")).n, 0, 'refusals write nothing');
  const ok = await demo.buildSet(db, big.key, { requireOn: false, anchor: ANCHOR, freeBytes: 50e9 }); assert.equal(ok.accounts, 50);
});

test('a stop leaves only whole accounts, and the Build reports it', async () => {
  const db = await fresh(), set = await tiny(db, 'Stopper', { accounts: 20, devices: { min: 2, max: 6, big: 0 } });
  let seen = 0; const out = await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR, onProgress: (done) => { seen = done; }, shouldStop: () => seen >= 3 });
  assert.equal(out.stopped, true); assert.equal(out.accounts, 3); assert.equal(out.planned, 20);
  assert.equal((await db.get('SELECT COUNT(*) n FROM accounts WHERE demo = 1')).n, 3);
  for (const a of await db.all('SELECT id FROM accounts WHERE demo = 1')) { assert.ok((await db.get('SELECT COUNT(*) n FROM account_users WHERE account_id = ?', [a.id])).n >= 1); assert.equal((await db.get('SELECT COUNT(*) n FROM account_recovery WHERE account_id = ?', [a.id])).n, 1); assert.ok((await db.get('SELECT COUNT(*) n FROM records WHERE account_id = ?', [a.id])).n > 0); }
  await assert.rejects(() => demo.buildSet(db, set.key, { requireOn: false }), (e) => e.code === 'DEMO_ALREADY_BUILT', 'a stopped set is removed or reset, not resumed');
  const gone = await demo.removeAccounts(db, { set: set.key, shouldStop: () => true }); assert.equal(gone.stopped, true, 'a removal can be stopped too');
  await demo.removeAccounts(db, { set: set.key }); assert.equal((await db.get('SELECT COUNT(*) n FROM accounts WHERE demo = 1')).n, 0);
});

test('Remove with a set key takes only that set', async () => {
  const db = await fresh(); await demo.buildSet(db, 'demo3', { requireOn: false, anchor: ANCHOR }); const a = await tiny(db, 'Alpha'); await demo.buildSet(db, a.key, { requireOn: false, anchor: ANCHOR });
  const st = await demo.builtStats(db); assert.equal(st.demo3.accounts, 3); assert.equal(st.alpha.accounts, 4);
  await demo.removeAccounts(db, { set: 'alpha' }); const after = await demo.builtStats(db); assert.equal(after.alpha, undefined); assert.equal(after.demo3.accounts, 3);
  assert.equal((await db.get("SELECT COUNT(*) n FROM demo_logins WHERE set_key = 'alpha'")).n, 0); assert.ok((await db.get("SELECT COUNT(*) n FROM demo_logins WHERE set_key = 'demo3'")).n >= 3);
  assert.deepEqual((await demo.demoTotals(db)).accounts, 3);
});

test('passwords: a named login resets and still opens its data; the shared filler password re-wraps every filler account', async () => {
  const db = await fresh(), set = await tiny(db, 'Pwd'); await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR });
  const std = await db.get("SELECT id FROM account_users WHERE login = 'pwd-std@pwd-001'"), ownerRow = await db.get("SELECT id FROM account_users WHERE login = 'pwd@pwd-001'");
  const oldStd = (await demo.passwordOf(db, std.id)).password, oldOwner = (await demo.passwordOf(db, ownerRow.id)).password;
  const r = await demo.resetPassword(db, std.id, {}); assert.notEqual(r.password, oldStd); assert.ok(r.password.length >= 12);
  const row = await db.get('SELECT pw_hash FROM account_users WHERE id = ?', [std.id]), k = await db.get('SELECT salt, iters, wrapped_adk FROM account_keys WHERE user_id = ?', [std.id]);
  assert.ok(verifyPassword(r.password, row.pw_hash)); assert.ok(!verifyPassword(oldStd, row.pw_hash));
  await V.unlock(r.password, { salt: k.salt, iters: Number(k.iters), wrappedAdk: k.wrapped_adk }); await assert.rejects(() => V.unlock(oldStd, { salt: k.salt, iters: Number(k.iters), wrappedAdk: k.wrapped_adk }));
  assert.equal((await demo.passwordOf(db, ownerRow.id)).password, oldOwner, 'other logins are unchanged');
  await assert.rejects(() => demo.resetPassword(db, std.id, { password: 'short1' }), (e) => e.code === 'DEMO_PASSWORD_BAD');
  const own = 'Chosen-Password-77'; assert.equal((await demo.resetPassword(db, std.id, { password: own })).password, own);
  // the filler row
  const filler = await db.get("SELECT user_id FROM demo_logins WHERE kind = 'filler' AND set_key = 'pwd'"); const oldF = (await demo.passwordOf(db, filler.user_id)).password;
  const fr = await demo.resetPassword(db, filler.user_id, {}); assert.ok(fr.people >= 3, 'every filler person was re-wrapped');
  for (const u of await db.all("SELECT u.id, u.pw_hash FROM account_users u JOIN accounts a ON a.id = u.account_id WHERE a.demo_set = 'pwd' AND u.login LIKE 'owner@%' OR u.login LIKE 'member%'")) {
    const kk = await db.get('SELECT salt, iters, wrapped_adk FROM account_keys WHERE user_id = ?', [u.id]); assert.ok(verifyPassword(fr.password, u.pw_hash));
    const adk = await V.unlock(fr.password, { salt: kk.salt, iters: Number(kk.iters), wrappedAdk: kk.wrapped_adk }); assert.ok(adk); await assert.rejects(() => V.unlock(oldF, { salt: kk.salt, iters: Number(kk.iters), wrappedAdk: kk.wrapped_adk }));
  }
  await assert.rejects(() => demo.passwordOf(db, 'no-such-user'), (e) => e.code === 'DEMO_LOGIN_UNKNOWN');
});

test('the Open ticket is single-use and short-lived, and real users have no demo login row', async () => {
  const db = await fresh(), set = await tiny(db, 'Tck'); await seedReal(db); await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR });
  const u = await db.get("SELECT id FROM account_users WHERE login = 'tck@tck-001'"), t = demo.makeTicket(u.id), x = await demo.redeemTicket(db, t);
  assert.equal(x.username, 'tck'); assert.equal(x.resellerId, 'tck-001'); assert.equal(x.password, (await demo.passwordOf(db, u.id)).password);
  await assert.rejects(() => demo.redeemTicket(db, t), (e) => e.code === 'DEMO_TICKET_GONE', 'second use');
  await assert.rejects(() => demo.redeemTicket(db, 'garbage'), (e) => e.code === 'DEMO_TICKET_GONE');
  const real = demo.makeTicket('ru1'); await assert.rejects(() => demo.redeemTicket(db, real), (e) => e.code === 'DEMO_LOGIN_UNKNOWN', 'a real user cannot be opened');
  await assert.rejects(() => demo.resetPassword(db, 'ru1', {}), (e) => e.code === 'DEMO_LOGIN_UNKNOWN');
});

test('mail to a demo address is never queued; mail to a real address still is', async () => {
  const db = await fresh();
  assert.equal(await enqueueMail(db, 'owner.tiny-001@demo.myboxstock.invalid', 'welcome', { name: 'x', accountCode: 'a', username: 'u', login: 'l', url: 'u', trialLine: '' }), null);
  assert.equal((await db.get('SELECT COUNT(*) n FROM mail_queue')).n, 0);
  assert.ok(await enqueueMail(db, 'real@example.com', 'welcome', { name: 'x', accountCode: 'a', username: 'u', login: 'l', url: 'u', trialLine: '' })); assert.equal((await db.get('SELECT COUNT(*) n FROM mail_queue')).n, 1);
  assert.ok(demo.isDemoAddress(' Someone@Demo.MyBoxStock.invalid ')); assert.ok(!demo.isDemoAddress('someone@example.com')); assert.ok(!demo.isDemoAddress('demo.myboxstock.invalid@example.com'));
  const { sendDirect } = await import('../src/services/mail/index.mjs'); await assert.rejects(() => sendDirect(db, { to: 'a@demo.myboxstock.invalid', subject: 's', text: 't' }), /demo_blocked/);
});

test('the sales trial sweep and the trials-ending alert skip demo accounts', async () => {
  const db = await fresh(), { sweepExpired } = await import('../src/services/billing/index.mjs');
  const t = Date.now();
  await db.run("INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, trial_ends_at, created_at, demo, demo_set) VALUES ('d1','tiny-001','Tiny','a@demo.myboxstock.invalid','active','trial',?,?,1,'tiny')", [t - 1000, t - 9999999]);
  await db.run("INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, trial_ends_at, created_at, demo) VALUES ('r1','amber-fox-1','Real','r@example.com','active','trial',?,?,0)", [t - 1000, t - 9999999]);
  assert.equal(await sweepExpired(db), 1, 'only the real account is swept'); assert.equal((await db.get("SELECT expiry_noted n FROM accounts WHERE id = 'd1'")).n, 0);
});

test('a backup copy leaves demo accounts out and the live database is untouched', async () => {
  const db = await fresh(); await seedReal(db); const set = await tiny(db, 'Bck'); await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR });
  const liveBefore = (await db.get('SELECT COUNT(*) n FROM records')).n, copy = path.join(dir, 'copy.db'); const sqlite = await import('node:sqlite'); await sqlite.backup(db.raw, copy);
  const out = await demo.stripDemoFromSnapshot(db, copy); assert.equal(out.removed, 4);
  const c = new DatabaseSync(copy, { readOnly: true }); try {
    assert.equal(c.prepare('SELECT COUNT(*) n FROM accounts WHERE demo = 1').get().n, 0); assert.equal(c.prepare('SELECT COUNT(*) n FROM accounts').get().n, 2); assert.equal(c.prepare('SELECT COUNT(*) n FROM records').get().n, 5);
    assert.equal(c.prepare('SELECT COUNT(*) n FROM demo_logins').get().n, 0); assert.equal(c.prepare('SELECT COUNT(*) n FROM account_users').get().n, 1);
    assert.equal(c.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { c.close(); }
  assert.equal((await db.get('SELECT COUNT(*) n FROM records')).n, liveBefore, 'the live database kept every demo record');
  // the setting turns it off
  await demo.saveOptions(db, { excludeFromBackups: false }); const copy2 = path.join(dir, 'copy2.db'); await sqlite.backup(db.raw, copy2); assert.equal((await demo.stripDemoFromSnapshot(db, copy2)).removed, 0);
  const c2 = new DatabaseSync(copy2, { readOnly: true }); try { assert.equal(c2.prepare('SELECT COUNT(*) n FROM accounts WHERE demo = 1').get().n, 4); } finally { c2.close(); }
});

test('settings: every number is editable, each set and the whole section reset to defaults, custom sets work, bad values are refused', async () => {
  const db = await fresh(); let sec = await demo.getDemo(db);
  assert.equal(sec.enabled, false, 'off by default'); assert.deepEqual(sec.sets.map(s => [s.key, s.accounts]), [['demo3', 3], ['demo300', 300], ['demo1000', 1000], ['demo5000', 5000]]);
  assert.deepEqual(sec.sets.map(s => [s.devices.min, s.devices.max]), [[20, 500], [10, 2000], [10, 2000], [10, 3000]]); assert.equal(sec.backupMaxAgeHours, 24); assert.equal(sec.excludeFromBackups, true); assert.equal(sec.usePlanCeiling, false);
  assert.deepEqual(sec.sets[1].shares, { sold: 55, available: 33, reserved: 2, returned: 4, damaged: 2, archived: 4 }); assert.equal(sec.sets[0].historyMonths, 12); assert.deepEqual(sec.sets[0].status, { trial: 40, free: 20, paid: 40 });
  await demo.saveSet(db, 'demo300', { accounts: 120, devices: { min: 5, max: 900, big: 2 }, team: { min: 2, max: 3 }, historyMonths: 6, seed: 5, status: { trial: 1, free: 1, paid: 8 } });
  let s = (await demo.getDemo(db)).sets.find(x => x.key === 'demo300'); assert.equal(s.accounts, 120); assert.equal(s.devices.max, 900); assert.equal(s.historyMonths, 6); assert.equal(s.status.paid, 8); assert.equal(s.name, 'Demo300', 'the name of a standard set cannot change');
  await demo.resetSet(db, 'demo300'); s = (await demo.getDemo(db)).sets.find(x => x.key === 'demo300'); assert.equal(s.accounts, 300); assert.equal(s.devices.max, 2000); assert.equal(s.seed, 300);
  for (const bad of [{ accounts: 0 }, { accounts: 99999 }, { accounts: 2.5 }, { devices: { min: 50, max: 10 } }, { team: { min: 5, max: 2 } }, { historyMonths: 0 }, { shares: { sold: 0, available: 0, reserved: 0, returned: 0, damaged: 0, archived: 0 } }, { roles: { Administrator: -1 } }]) await assert.rejects(() => demo.saveSet(db, 'demo3', bad), (e) => e.code === 'DEMO_SETTINGS_BAD', JSON.stringify(bad));
  const c = await demo.saveSet(db, '', { name: 'Pilot2', accounts: 12 }, { create: true }); assert.equal(c.key, 'pilot2'); assert.equal(c.custom, true);
  for (const name of ['', 'ab', '9lives', 'has space', 'x'.repeat(21), 'Demo3']) await assert.rejects(() => demo.saveSet(db, '', { name }, { create: true }), (e) => e.code === 'DEMO_CUSTOM_BAD', name);
  await demo.saveSet(db, 'pilot2', { accounts: 30 }); assert.equal((await demo.resetSet(db, 'pilot2')).accounts, 10, 'a Custom set resets to a small generic recipe and keeps its name');
  await demo.saveOptions(db, { backupMaxAgeHours: 6, excludeFromBackups: false, usePlanCeiling: true, limits: { accounts: 100 } }); await demo.setEnabled(db, true);
  await demo.saveSet(db, 'demo3', { seed: 42 });
  await demo.resetAll(db); sec = await demo.getDemo(db);
  assert.equal(sec.enabled, true, 'Reset all keeps the on/off switch'); assert.equal(sec.backupMaxAgeHours, 24); assert.equal(sec.excludeFromBackups, true); assert.equal(sec.usePlanCeiling, false); assert.equal(sec.limits.accounts, 5000);
  assert.equal(sec.sets.find(x => x.key === 'demo3').seed, 3); assert.ok(!sec.sets.some(x => x.custom), 'Custom sets leave the list');
  await assert.rejects(() => demo.saveOptions(db, { backupMaxAgeHours: 0 }), (e) => e.code === 'DEMO_SETTINGS_BAD'); await assert.rejects(() => demo.resetSet(db, 'nope'), (e) => e.code === 'DEMO_SET_UNKNOWN');
});

test('the plan ceiling uses the real Plans page without changing it', async () => {
  const db = await fresh(); await seedReal(db); const before = JSON.stringify(await db.all("SELECT * FROM settings WHERE k = 'plans'"));
  const set = await tiny(db, 'Cap', { accounts: 6, devices: { min: 100, max: 2000, big: 2 } }); await demo.saveOptions(db, { usePlanCeiling: true });
  await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR }); const counts = await db.all("SELECT account_id, COUNT(*) n FROM records WHERE type = 'item' GROUP BY account_id");
  assert.ok(counts.every(c => c.n <= 500), 'no account has more devices than the largest plan allows (500)'); assert.equal(JSON.stringify(await db.all("SELECT * FROM settings WHERE k = 'plans'")), before, 'the Plans page is unchanged');
});

test('who may manage Demo mode: Owner and Administrator, not a read-only Host role', () => {
  assert.ok(demo.canManage({ username: 'admin' })); assert.ok(demo.canManage({ role: 'Owner' })); assert.ok(demo.canManage({ role: 'administrator' }));
  assert.ok(!demo.canManage({ role: 'View' })); assert.ok(!demo.canManage({ role: 'Support' }));
});

test('the estimate is exact for accounts, people and devices, and close for records and size', async () => {
  const db = await fresh(), set = await tiny(db, 'Est', { accounts: 30, devices: { min: 5, max: 80, big: 2 } }), est = demo.estimate(set, { anchor: ANCHOR });
  const out = await demo.buildSet(db, set.key, { requireOn: false, anchor: ANCHOR });
  assert.equal(est.accounts, out.accounts); assert.equal(est.users, out.users); assert.equal(est.devices, out.devices);
  assert.ok(Math.abs(est.records - out.records) / out.records < 0.25, `records ${est.records} vs ${out.records}`);
  assert.ok(est.largest >= 56 && est.largest <= 80, 'a very large account exists'); assert.ok(est.seconds >= 2);
});
