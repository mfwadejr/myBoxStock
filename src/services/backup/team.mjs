// SERVICES / backup / team — Team members that come back from a backup file as pending invitations.
// A pending invitation is an ordinary team member whose stored password hash is the marker below instead of a real hash, so nobody can sign in as them
// until an Administrator gives them a temporary password (Reset access), after which they choose their own password and set up their own two-factor.
// The marker also names the restore that added them (the safety copy's time), so "Undo last restore" removes exactly the invitations that restore added.
// Names, emails and roles are not secret from the server (they are already in the Team list); passwords, two-factor secrets and sessions are never in a backup file.
import { newId } from '../../core/ids.mjs';

export const INVITED = '!invited:';
export const isPending = (hash) => String(hash || '').startsWith(INVITED);
export const MAX_PEOPLE = 500;
const USERNAME = /^[a-z0-9._-]{3,30}$/i;

// people: [{ username, email, role }] from the file. Skips anyone who matches a current member by username or email (no duplicates, no role changes).
// Returns { added: [{ id, login, role }], skipped: [{ username, reason }] } where reason is 'exists', 'role' (not a role in this account) or 'invalid'.
export async function addInvitations(db, { accountId, accountCode, stamp, people }) {
  const roles = new Set((await db.all('SELECT name FROM account_roles WHERE account_id = ?', [accountId])).map(r => r.name));
  const have = await db.all('SELECT username, email FROM account_users WHERE account_id = ?', [accountId]);
  const names = new Set(have.map(u => String(u.username).toLowerCase())), mails = new Set(have.map(u => String(u.email || '').trim().toLowerCase()).filter(Boolean));
  const added = [], skipped = [], now = Date.now();
  for (const p of people.slice(0, MAX_PEOPLE)) {
    const username = String(p?.username || '').trim().toLowerCase(), email = String(p?.email || '').trim().toLowerCase().slice(0, 254), role = String(p?.role || '');
    if (!USERNAME.test(username) || (email && !/^[^\s@]+@[^\s@]+$/.test(email))) { skipped.push({ username: username || '?', reason: 'invalid' }); continue; }
    if (names.has(username) || (email && mails.has(email))) { skipped.push({ username, reason: 'exists' }); continue; }
    if (!roles.has(role)) { skipped.push({ username, reason: 'role' }); continue; }
    const id = newId(), login = `${username}@${String(accountCode).toLowerCase()}`;
    if (await db.get('SELECT id FROM account_users WHERE login = ?', [login])) { skipped.push({ username, reason: 'exists' }); continue; }
    await db.run('INSERT INTO account_users (id, account_id, login, username, email, role, pw_hash, must_change, created_at) VALUES (?,?,?,?,?,?,?,1,?)', [id, accountId, login, username, email || null, role, INVITED + stamp, now]);
    names.add(username); if (email) mails.add(email); added.push({ id, login, role });
  }
  return { added, skipped };
}

// Removes the invitations a restore added (only those still pending). Returns how many.
export async function removeInvitations(db, accountId, stamp) {
  const rows = await db.all('SELECT id FROM account_users WHERE account_id = ? AND pw_hash = ?', [accountId, INVITED + stamp]);
  for (const u of rows) await db.tx(async (t) => {
    await t.run("DELETE FROM sessions WHERE realm = 'app' AND subject_id = ?", [u.id]);
    await t.run("DELETE FROM password_resets WHERE realm = 'app' AND subject_id = ?", [u.id]);
    await t.run('DELETE FROM account_keys WHERE user_id = ?', [u.id]);
    await t.run('DELETE FROM sign_in_history WHERE user_id = ? AND account_id = ?', [u.id, accountId]);
    await t.run('DELETE FROM account_users WHERE id = ? AND account_id = ?', [u.id, accountId]);
  });
  return rows.length;
}
