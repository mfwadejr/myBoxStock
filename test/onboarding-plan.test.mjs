// TEST / onboarding-plan — Host Onboarding uses the same plan rule as Accounts: Free counts as done (with its own flag and count), an ended trial or paid period is flagged instead of counted, and "Stopped at" says Finished setup.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client } from './helpers.mjs';

const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let srv, host, d;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
  if (sqlite) { const { DatabaseSync } = await import('node:sqlite'); d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000'); }
});
test.after(() => srv?.stop());
const signup = async (biz, user) => (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: biz, email: `${user}@example.com`, username: user, password: PW })).data.resellerId;

test('onboarding route: funnel, Free, ended plans and Finished setup follow billingState', { skip: !sqlite && 'SQLite-only (moves dates)' }, async () => {
  const trial = await signup('Trial Co', 'tina'), free = await signup('Free Co', 'fred'), tEnd = await signup('Trial Ended Co', 'tess'), pEnd = await signup('Paid Ended Co', 'paul'), paid = await signup('Paid Co', 'pam');
  const id = (code) => (d.prepare('SELECT id FROM accounts WHERE account_code = ?').get(code)).id;
  const past = Date.now() - 3 * 86400e3, future = Date.now() + 30 * 86400e3;
  d.prepare("UPDATE accounts SET plan = 'free', trial_ends_at = NULL, plan_until = NULL WHERE account_code = ?").run(free);
  d.prepare("UPDATE accounts SET plan = 'trial', trial_ends_at = ? WHERE account_code = ?").run(past, tEnd);
  d.prepare("UPDATE accounts SET plan = 'paid', plan_until = ? WHERE account_code = ?").run(past, pEnd);
  d.prepare("UPDATE accounts SET plan = 'paid', plan_until = ? WHERE account_code = ?").run(future, paid);
  d.prepare("UPDATE accounts SET plan = 'trial', trial_ends_at = ? WHERE account_code = ?").run(future, trial);
  // Make "paid" a fully finished account: confirmed email, signed in, recovery key saved.
  d.prepare('UPDATE account_users SET email_verified_at = ?, last_login = ? WHERE account_id = ?').run(Date.now(), Date.now(), id(paid));
  const recovered = (code) => { d.prepare('DELETE FROM account_recovery WHERE account_id = ?').run(id(code)); d.prepare('INSERT INTO account_recovery (account_id, wrapped_adk, created_at, confirmed_at) VALUES (?,?,?,?)').run(id(code), 'x', Date.now(), Date.now()); };
  recovered(paid);
  const r = (await host.req('GET', '/api/host/onboarding?days=0')); assert.equal(r.status, 200);
  const by = Object.fromEntries(r.data.accounts.map(a => [a.code, a]));
  assert.equal(by[free].steps.planStarted, true, 'Free counts as the final step done'); assert.equal(by[free].free, true); assert.equal(by[free].planEnded, false);
  assert.equal(by[trial].steps.planStarted, true); assert.equal(by[trial].free, false);
  for (const c of [tEnd, pEnd]) { assert.equal(by[c].steps.planStarted, false, 'an ended period does not count as started'); assert.equal(by[c].planEnded, true); assert.equal(by[c].stuckAt, 'Email confirmed', 'earlier steps still come first'); }
  assert.equal(by[tEnd].plan, 'trial_expired'); assert.equal(by[pEnd].plan, 'paid_expired');
  assert.equal(r.data.freeCount, 1); assert.equal(r.data.endedCount, 2);
  assert.equal(r.data.funnel.find(f => f.key === 'planStarted').count, 3, 'free + running trial + running paid');
  assert.equal(by[paid].stuckAt, null); assert.equal(by[paid].finished, true, 'every step done');
  assert.equal(by[free].finished, false); assert.equal(by[free].stuckAt, 'Email confirmed', 'a done step is never the one it stopped at');
  // An ended account that finished every other step stops at "Plan ended".
  d.prepare('UPDATE account_users SET email_verified_at = ?, last_login = ? WHERE account_id = ?').run(Date.now(), Date.now(), id(pEnd));
  recovered(pEnd);
  const r2 = (await host.req('GET', '/api/host/onboarding?days=0')).data.accounts.find(a => a.code === pEnd); assert.equal(r2.stuckAt, 'Plan ended'); assert.equal(r2.finished, false);
  // The Accounts page agrees on who is Free and who has ended.
  const acc = (await host.req('GET', '/api/host/accounts')).data;
  assert.equal(acc.find(a => a.account_code === free).billing.state, 'free'); assert.equal(acc.find(a => a.account_code === tEnd).billing.state, 'trial_expired');
});
