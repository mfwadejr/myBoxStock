// TEST / migrations — an install created before plans existed upgrades in place, keeping its accounts (as free).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openSqlite } from '../src/db/drivers.mjs';
import { TABLES, INDEXES, migrate, COPY_ORDER } from '../src/db/schema.mjs';
import { billingState } from '../src/services/billing/state.mjs';

test('v1 database upgrades to the latest schema without losing data', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-mig-')), 'old.db'), db = await openSqlite(file);
  await db.exec('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)');
  for (const [, ddl] of TABLES) await db.exec(ddl);
  for (const ddl of INDEXES) await db.exec(ddl);
  await db.run('INSERT INTO schema_migrations (id, applied_at) VALUES (1, ?)', [Date.now()]);
  await db.run("INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at) VALUES ('a1','BX-OLD111','Old Co','o@x.com','active','free',1)");
  assert.equal(await migrate(db), true, 'applies the missing migration');
  const a = await db.get('SELECT * FROM accounts WHERE id = ?', ['a1']);
  assert.equal(a.business_name, 'Old Co'); assert.equal(billingState(a).state, 'free'); assert.equal(billingState(a).canWrite, true);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM billing_events')).n, 0);
  assert.equal(await migrate(db), false, 'running again is a no-op');
  await db.close(); fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test('migration 14 adds security_blocks (lockouts and bans), unique per kind and subject, and it is copied between databases', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-mig-')), 'blocks.db'), db = await openSqlite(file);
  await migrate(db);
  assert.ok(await db.get('SELECT id FROM schema_migrations WHERE id = 14'), 'migration 14 recorded');
  assert.ok(COPY_ORDER.includes('security_blocks'));
  await db.run("INSERT INTO security_blocks (id, kind, subject, hits, reason, created_at, expires_at) VALUES ('b1','ban','203.0.113.1',0,'test',1,99)");
  await assert.rejects(db.run("INSERT INTO security_blocks (id, kind, subject, hits, reason, created_at, expires_at) VALUES ('b2','ban','203.0.113.1',0,'test',1,99)"), 'one row per kind and subject');
  await db.close(); fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test('migration 15 adds the last-backup time and the 7-day restore point tables, and they are copied between databases', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-mig-')), 'rp.db'), db = await openSqlite(file);
  await migrate(db);
  assert.ok(await db.get('SELECT id FROM schema_migrations WHERE id = 15'), 'migration 15 recorded');
  await db.run("INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at, last_backup_at) VALUES ('a1','BX-RP1','Rp Co','o@x.com','active','free',1,5)");
  await db.run("INSERT INTO restore_points (account_id, created_at, expires_at, created_by, record_count, mode) VALUES ('a1',1,2,'x',1,'merge')");
  await db.run("INSERT INTO restore_point_records (account_id, id, type, blob, rev, created_at, updated_at) VALUES ('a1','r1','item','v1.a.b',1,1,1)");
  assert.equal(Number((await db.get('SELECT last_backup_at FROM accounts WHERE id = ?', ['a1'])).last_backup_at), 5);
  assert.ok(COPY_ORDER.includes('restore_points') && COPY_ORDER.includes('restore_point_records'));
  await db.close(); fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test('migration 16 adds the Terms version and time to accounts; existing accounts stay empty (asked once at next sign-in)', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-mig-')), 'terms.db'), db = await openSqlite(file);
  await migrate(db);
  assert.ok(await db.get('SELECT id FROM schema_migrations WHERE id = 16'), 'migration 16 recorded');
  await db.run("INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, created_at) VALUES ('a1','BX-T1','Old Co','o@x.com','active','free',1)");
  let a = await db.get('SELECT terms_version, terms_accepted_at FROM accounts WHERE id = ?', ['a1']);
  assert.equal(a.terms_version, null); assert.equal(a.terms_accepted_at, null);
  await db.run("UPDATE accounts SET terms_version = '2026-10-07-draft', terms_accepted_at = 5 WHERE id = 'a1'");
  a = await db.get('SELECT terms_version, terms_accepted_at FROM accounts WHERE id = ?', ['a1']);
  assert.equal(a.terms_version, '2026-10-07-draft'); assert.equal(Number(a.terms_accepted_at), 5);
  await db.close(); fs.rmSync(path.dirname(file), { recursive: true, force: true });
});
