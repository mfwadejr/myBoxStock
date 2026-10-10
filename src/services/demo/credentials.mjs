// SERVICES / demo / credentials — the demo logins table: which logins exist, Show and Copy a password, Reset password, and the one-time ticket behind "Open as this reseller".
// Passwords are made at Build and kept sealed with the server key (recoverable, because demo accounts hold only made-up data; a real account never gets a row here).
// A password is returned only to the route that was asked for it, which writes the audit entry first; it is never written to a log, an email or a ticket.
import crypto from 'node:crypto';
import { seal, unseal } from '../../auth/secrets.mjs';
import { hashPassword, passwordProblem } from '../../auth/password.mjs';
import { destroyAllFor } from '../../auth/session.mjs';
import { getDemo } from './settings.mjs';
import { builtStats } from './remove.mjs';
import { demoVault, DEMO_ITERS } from './vault.mjs';
import { genPassword } from './build.mjs';
import { coded } from './audit.mjs';

const KIND_LABEL = { owner: 'Owner', std: 'Standard', view: 'View', filler: 'All other accounts in the set' };
const username = (login) => login.slice(0, login.lastIndexOf('@'));

// One entry per set (built or not) with its logins. Built sets list their real login rows; sets not built yet list the names they will get.
export async function credentialRows(db) {
  const section = await getDemo(db), stats = await builtStats(db);
  const rows = await db.all('SELECT d.user_id, d.set_key, d.kind, d.login, d.role, d.created_at, d.rotated_at, a.account_code FROM demo_logins d JOIN accounts a ON a.id = d.account_id ORDER BY d.set_key, d.created_at, d.kind');
  const keys = [...new Set([...section.sets.map(s => s.key), ...Object.keys(stats)])];
  return keys.map(k => {
    const s = section.sets.find(x => x.key === k), st = stats[k] || null, mine = rows.filter(r => r.set_key === k);
    const order = ['owner', 'std', 'view', 'filler'];
    const logins = st ? mine.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).map(r => ({ id: r.user_id, kind: r.kind, label: KIND_LABEL[r.kind], username: r.kind === 'filler' ? 'owner (and member2, member3 ...)' : username(r.login), login: r.kind === 'filler' ? `owner@${k}-0001` : r.login, role: r.role, rotatedAt: r.rotated_at ? Number(r.rotated_at) : null }))
      : [['owner', k], ['std', `${k}-std`], ['view', `${k}-view`]].map(([kind, u]) => ({ id: null, kind, label: KIND_LABEL[kind], username: u, login: null, role: kind === 'owner' ? 'Administrator' : kind === 'std' ? 'Standard' : 'View', rotatedAt: null }));
    return { key: k, name: s?.name || k, custom: !!s?.custom, built: !!st, counts: st ? { accounts: st.accounts, users: st.users, records: st.records } : null, builtAt: st?.builtAt || null, planned: s?.accounts ?? null, logins };
  });
}
const rowOf = async (db, userId) => { const r = await db.get('SELECT user_id, set_key, kind, login, pw_sealed, account_id FROM demo_logins WHERE user_id = ?', [userId]); if (!r) throw coded('DEMO_LOGIN_UNKNOWN'); return r; };
export async function passwordOf(db, userId) { const r = await rowOf(db, userId); return { password: unseal(r.pw_sealed), login: r.login, set: r.set_key, kind: r.kind }; }

// Sets a new password. `password` empty = generate. A named login re-wraps its own key; the shared filler password re-wraps every filler person in the set (a quick key change; no slow key work).
export async function resetPassword(db, userId, { password = '' } = {}) {
  const r = await rowOf(db, userId), V = demoVault(), old = unseal(r.pw_sealed);
  let next = String(password || ''); if (next) { const bad = passwordProblem(next); if (bad || next.length < 12) throw coded('DEMO_PASSWORD_BAD'); } else next = genPassword();
  const hash = hashPassword(next), now = Date.now();
  if (r.kind !== 'filler') {
    const k = await db.get('SELECT salt, iters, wrapped_adk FROM account_keys WHERE user_id = ?', [r.user_id]);
    const adk = await V.unlock(old, { salt: k.salt, iters: Number(k.iters), wrappedAdk: k.wrapped_adk }), keys = await V.keysFor(next, adk, DEMO_ITERS);
    await db.tx(async (t) => {
      await t.run('UPDATE account_users SET pw_hash = ?, must_change = 0 WHERE id = ?', [hash, r.user_id]);
      await t.run('UPDATE account_keys SET salt = ?, iters = ?, wrapped_adk = ?, updated_at = ? WHERE user_id = ?', [keys.salt, keys.iters, keys.wrappedAdk, now, r.user_id]);
      await t.run('UPDATE demo_logins SET pw_sealed = ?, rotated_at = ? WHERE user_id = ?', [seal(next), now, r.user_id]);
    });
    await destroyAllFor(db, 'app', r.user_id, 'demo password reset');
    return { password: next, people: 1 };
  }
  const salt = V.newSalt(); let people = 0;
  const first = await db.get('SELECT salt, iters FROM account_keys WHERE user_id = ?', [r.user_id]), kekOld = await V.deriveKek(old, first.salt, Number(first.iters)), kekNew = await V.deriveKek(next, salt, DEMO_ITERS);
  const ids = (await db.all("SELECT u.id, k.wrapped_adk FROM account_users u JOIN accounts a ON a.id = u.account_id JOIN account_keys k ON k.user_id = u.id WHERE a.demo = 1 AND a.demo_set = ? AND k.salt = ?", [r.set_key, first.salt]));
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100), wrapped = await Promise.all(part.map(async u => V.wrapAdk(await V.unwrapAdk(u.wrapped_adk, kekOld), kekNew)));
    await db.tx(async (t) => { for (let j = 0; j < part.length; j++) { await t.run('UPDATE account_users SET pw_hash = ?, must_change = 0 WHERE id = ?', [hash, part[j].id]); await t.run('UPDATE account_keys SET salt = ?, iters = ?, wrapped_adk = ?, updated_at = ? WHERE user_id = ?', [salt, DEMO_ITERS, wrapped[j], now, part[j].id]); } });
    people += part.length;
  }
  await db.run('UPDATE demo_logins SET pw_sealed = ?, rotated_at = ? WHERE user_id = ?', [seal(next), now, r.user_id]);
  await db.run("DELETE FROM sessions WHERE realm = 'app' AND account_id IN (SELECT id FROM accounts WHERE demo = 1 AND demo_set = ?)", [r.set_key]);
  return { password: next, people };
}

// "Open as this reseller": a one-time ticket good for 60 seconds. The app redeems it for the sign-in name and password, then signs in the normal way (so normal sign-in limits apply).
const tickets = new Map();
export function makeTicket(userId) {
  for (const [k, v] of tickets) if (v.exp < Date.now()) tickets.delete(k);
  const t = crypto.randomBytes(24).toString('base64url'); tickets.set(t, { userId, exp: Date.now() + 60e3 }); return t;
}
export async function redeemTicket(db, t) {
  const x = tickets.get(String(t)); tickets.delete(String(t)); if (!x || x.exp < Date.now()) throw coded('DEMO_TICKET_GONE');
  const r = await rowOf(db, x.userId); return { login: r.login, username: username(r.login), resellerId: r.login.slice(r.login.lastIndexOf('@') + 1), password: unseal(r.pw_sealed), set: r.set_key };
}
