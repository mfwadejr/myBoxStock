// TEST / migrations — an install created before plans existed upgrades in place, keeping its accounts (as free).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openSqlite } from '../src/db/drivers.mjs';
import { TABLES, INDEXES, migrate } from '../src/db/schema.mjs';
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
