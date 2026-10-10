// SERVICES / demo / build — builds one size set: checks the safety limits, the free disk and name clashes, then makes each demo account (tagged demo = 1), its people, its keys and its
// encrypted records, one account at a time, so a stop leaves only whole accounts. Real accounts are never read or changed: the only rows this file writes are new ones.
// The same function is used by the Host console's Build job and by tools and tests (a measurement script builds Demo300 or Demo5000 with it).
import crypto from 'node:crypto';
import { hashPassword } from '../../auth/password.mjs';
import { seal } from '../../auth/secrets.mjs';
import { newId } from '../../core/ids.mjs';
import { TERMS_VERSION } from '../legal/index.mjs';
import { snapshot } from '../system/metrics.mjs';
import { jobStep, jobBytes, jobStopRequested } from '../backup/progress.mjs';
import { DEFAULT_ROLES } from '../../routes/app/context.mjs';
import { getDemo } from './settings.mjs';
import { planAccount, estimate, bigIndexes, domain, BYTES_PER_RECORD } from './plan.mjs';
import { recordsFor } from './records.mjs';
import { stableHex } from './rng.mjs';
import { demoVault, DEMO_ITERS } from './vault.mjs';
import { coded, audit } from './audit.mjs';

export const SLACK_BYTES = 256 * 1048576;
const ALPHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
// A strong generated password: 16 characters, letters and digits only (easy to copy), always with both.
export function genPassword() {
  for (;;) { const p = Array.from(crypto.randomBytes(16), b => ALPHA[b % ALPHA.length]).join(''); if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /[2-9]/.test(p)) return p; }
}
const loginOf = (username, code) => `${username}@${code}`.toLowerCase();

// Real data that would clash with this set: a real account whose name starts with the set's name or whose Reseller ID starts with its key, or a real sign-in with one of its names.
// Returns a list of plain descriptions (empty = no clash). Reads only identity columns of accounts that are NOT demo.
export async function nameClashes(db, set) {
  const out = [], key = set.key, like = (s) => s.replace(/[\\%_]/g, '\\$&') + '%';
  const byName = await db.all("SELECT business_name FROM accounts WHERE demo = 0 AND LOWER(business_name) LIKE ? ESCAPE '\\' LIMIT 3", [like(set.name.toLowerCase())]);
  const byCode = await db.all("SELECT account_code FROM accounts WHERE demo = 0 AND LOWER(account_code) LIKE ? ESCAPE '\\' LIMIT 3", [like(key + '-')]);
  const byUser = await db.all("SELECT u.login FROM account_users u JOIN accounts a ON a.id = u.account_id WHERE a.demo = 0 AND (u.login LIKE ? ESCAPE '\\' OR u.login = ?) LIMIT 3", [like(key), key]);
  for (const r of byName) out.push(`a real account is named "${r.business_name}"`);
  for (const r of byCode) out.push(`a real account has the Reseller ID ${r.account_code}`);
  for (const r of byUser) out.push(`a real sign-in "${r.login}" exists`);
  return out;
}

// Everything checked before anything is written. Throws a coded error; returns the estimate when it is fine.
export async function checkBuild(db, set, { section = null, ceiling = 0, anchor = Date.now(), requireOn = true, skipBuilt = false, freeBytes = null } = {}) {
  section = section || await getDemo(db);
  if (requireOn && !section.enabled) throw coded('DEMO_OFF');
  if (!skipBuilt && await db.get('SELECT id FROM accounts WHERE demo = 1 AND demo_set = ? LIMIT 1', [set.key])) throw coded('DEMO_ALREADY_BUILT');
  const clash = await nameClashes(db, set); if (clash.length) throw coded('DEMO_NAME_CLASH', { clashes: clash });
  const est = estimate(set, { ceiling, anchor }), L = section.limits;
  if (set.accounts > L.accounts || est.largest > L.devicesPerAccount || est.records > L.records) throw coded('DEMO_TOO_BIG', { estimate: est });
  const free = freeBytes ?? snapshot().disk?.free;   // freeBytes lets tests and tools state the free space
  if (free != null && free < est.bytes * 1.5 + SLACK_BYTES) throw coded('DEMO_DISK', { need: Math.round(est.bytes * 1.5 + SLACK_BYTES), free, estimate: est });
  return est;
}
// The biggest device count the real Plans page allows, when "use real plans as a ceiling" is on. Reads the plan list only.
export async function planCeiling(db, section) {
  if (!section.usePlanCeiling) return 0;
  const { getSetting } = await import('../../db/settings.mjs'); const plans = await getSetting(db, 'plans', []);
  return plans.reduce((m, p) => Math.max(m, Number(p.maxDevices) || 0), 0) || 0;
}

const CHUNK = 200;
async function insertRecords(t, accountId, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    await t.run(`INSERT INTO records (id, account_id, type, blob, rev, created_at, updated_at) VALUES ${part.map(() => '(?,?,?,?,1,?,?)').join(',')}`, part.flatMap(x => [x.id, accountId, x.type, x.blob, x.at, x.at]));
  }
}
async function sealAll(V, adk, recs, now) {
  const out = [];
  for (let i = 0; i < recs.length; i += 250) {
    const part = recs.slice(i, i + 250);
    out.push(...await Promise.all(part.map(async r => ({ id: r.id, type: r.type, blob: await V.seal(adk, r.data, r.id, r.type), at: Number(r.data.addedAt || r.data.ts || r.data.createdAt) || now }))));
  }
  return out;
}

// Builds the set. Options: actor, ip, anchor (the "now" the dates count back from), section (settings), requireOn (false for tools and tests), shouldStop(), onProgress(done, total).
// Returns { accounts, users, devices, records, stopped, ms, logins }. Throws a coded error for a refused build; any other failure removes what this build made.
export async function buildSet(db, key, opts = {}) {
  const { actor = 'System', ip = null, anchor = Date.now(), requireOn = true } = opts, section = opts.section || await getDemo(db);
  const set = section.sets.find(s => s.key === key); if (!set) throw coded('DEMO_SET_UNKNOWN');
  const ceiling = await planCeiling(db, section), est = await checkBuild(db, set, { section, ceiling, anchor, requireOn, freeBytes: opts.freeBytes ?? null });
  const V = demoVault(), t0 = Date.now(), now = Date.now(), stopNow = () => !!(opts.shouldStop?.() || jobStopRequested());
  jobStep('Preparing the set', 1, 4);
  const fillerPw = genPassword(), filler = { hash: hashPassword(fillerPw), salt: V.newSalt() }; filler.kek = await V.deriveKek(fillerPw, filler.salt, DEMO_ITERS);
  const named = {}; // password per named login kind
  const totals = { accounts: 0, users: 0, devices: 0, records: 0 }; let stopped = false, fillerUser = null;
  jobStep(`Building ${set.accounts.toLocaleString('en-US')} accounts`, 4, 97);
  const big = bigIndexes(set);
  try {
    for (let i = 0; i < set.accounts; i++) {
      if (stopNow()) { stopped = true; break; }
      const p = planAccount(set, i, anchor, { ceiling, big }), adk = await V.newAdk(), rec = V.newRecoveryKey();
      const accountId = stableHex(set.seed, set.key, 'account', i, anchor), owner = p.users[0];
      const recovery = await V.wrapWithRecovery(adk, rec.text);
      // people, with a sign-in hash and key material each
      const users = [];
      for (const u of p.users) {
        const id = stableHex(set.seed, set.key, 'user', i, u.username), login = loginOf(u.username, p.code), email = `${u.username}.${p.code}@${domain}`;
        if (u.kind === 'filler') users.push({ ...u, id, login, email, hash: filler.hash, keys: { salt: filler.salt, iters: DEMO_ITERS, wrappedAdk: await V.wrapAdk(adk, filler.kek) } });
        else { const pw = named[u.kind] = genPassword(); users.push({ ...u, id, login, email, pw, hash: hashPassword(pw), keys: await V.keysFor(pw, adk, DEMO_ITERS) }); }
      }
      const made = recordsFor(set, p, anchor), sealed = await sealAll(V, adk, [...made.models, ...made.items, ...made.customers, ...made.sales], now);
      await db.tx(async (t) => {
        await t.run('INSERT INTO accounts (id, account_code, business_name, owner_email, status, plan, trial_ends_at, plan_until, plan_changed_at, created_at, last_activity, terms_version, terms_accepted_at, demo, demo_set) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)',
          [accountId, p.code, p.name, users[0].email, 'active', p.plan, p.trialEnds, p.planUntil, p.createdAt, p.createdAt, now, TERMS_VERSION, now, set.key]);
        for (const [name, perms] of Object.entries(DEFAULT_ROLES)) await t.run('INSERT INTO account_roles (id, account_id, name, perms, builtin) VALUES (?,?,?,?,1)', [newId(), accountId, name, JSON.stringify(perms)]);
        for (const u of users) {
          await t.run('INSERT INTO account_users (id, account_id, login, username, email, role, pw_hash, must_change, disabled, created_at, email_verified_at, email_grandfathered) VALUES (?,?,?,?,?,?,?,0,0,?,?,1)', [u.id, accountId, u.login, u.username, u.email, u.role, u.hash, p.createdAt, now]);
          await t.run('INSERT INTO account_keys (user_id, account_id, salt, iters, wrapped_adk, updated_at) VALUES (?,?,?,?,?,?)', [u.id, accountId, u.keys.salt, u.keys.iters, u.keys.wrappedAdk, now]);
          if (u.kind !== 'filler') await t.run('INSERT INTO demo_logins (user_id, account_id, set_key, kind, login, role, pw_sealed, created_at) VALUES (?,?,?,?,?,?,?,?)', [u.id, accountId, set.key, u.kind, u.login, u.role, seal(u.pw), now]);
          else if (!fillerUser) { fillerUser = u; await t.run('INSERT INTO demo_logins (user_id, account_id, set_key, kind, login, role, pw_sealed, created_at) VALUES (?,?,?,?,?,?,?,?)', [u.id, accountId, set.key, 'filler', u.login, u.role, seal(fillerPw), now]); }
        }
        await t.run('INSERT INTO account_recovery (account_id, wrapped_adk, created_at, confirmed_at) VALUES (?,?,?,?)', [accountId, recovery, now, now]);
        await insertRecords(t, accountId, sealed);
      });
      totals.accounts++; totals.users += users.length; totals.devices += p.devices; totals.records += sealed.length;
      jobBytes(totals.accounts, set.accounts); opts.onProgress?.(totals.accounts, set.accounts);
      if (totals.accounts % 5 === 0 || p.devices > 300) await new Promise(r => setImmediate(r));   // let the live site breathe
      if (i === 0) await verifyFirst(db, V, users.find(u => u.kind === 'owner') || users[0], accountId);
    }
  } catch (e) {
    await removeBuilt(db, set.key).catch(() => {});   // a failed build leaves nothing behind
    throw e;
  }
  const ms = Date.now() - t0;
  const logins = Object.entries(named).map(([kind, password]) => ({ kind, password }));
  audit(stopped ? 'demo.stopped' : 'demo.build', `${stopped ? 'Demo build of' : 'Built'} ${set.name}: ${totals.accounts} accounts, ${totals.users} people, ${totals.devices} devices, ${totals.records} records in ${Math.round(ms / 1000)} s${stopped ? ' (stopped early; the finished accounts were kept)' : ''}`, { actor, ip, level: stopped ? 'warn' : 'info', data: { set: set.key, ...totals, ms, stopped, planned: set.accounts, estimate: est } });
  return { ...totals, stopped, ms, logins, estimate: est, planned: set.accounts };
}

// The last check of a build: the first account's records open with the owner's real password, the way the browser opens them.
async function verifyFirst(db, V, owner, accountId) {
  const keys = await db.get('SELECT salt, iters, wrapped_adk FROM account_keys WHERE user_id = ?', [owner.id]), row = await db.get("SELECT id, type, blob FROM records WHERE account_id = ? AND type = 'item' LIMIT 1", [accountId]);
  if (!row) return;
  const adk = await V.unlock(owner.pw ?? '', { salt: keys.salt, iters: Number(keys.iters), wrappedAdk: keys.wrapped_adk }).catch(() => null);
  if (!adk) throw coded('DEMO_VERIFY');
  await V.open(adk, row.blob, row.id, row.type);
}
// Removes only this set's demo accounts (used to clean up a failed build). Lives in remove.mjs for the console; imported lazily to avoid a cycle.
async function removeBuilt(db, key) { const { removeAccounts } = await import('./remove.mjs'); return removeAccounts(db, { set: key }); }
export { BYTES_PER_RECORD };
