// SERVICES / backup / passphrase — the backup passphrase kept sealed in the full-site settings (never logged, never sent to the browser),
// and the three things the Host can do with it from Backup setup: Check my passphrase, Change passphrase, Reset (forgotten).
// Every action is written to the audit trail by name only. A history of WHEN it changed (never the passphrase, not even a hash) is kept in the
// setup record so Test restore can say "this copy was made with an earlier passphrase" instead of just failing.
import crypto from 'node:crypto';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { seal, unseal } from '../../auth/secrets.mjs';
import { audit } from './audit.mjs';
import { MIN_PASSPHRASE } from './bundle.mjs';
import { coded, getSetupRecord, updateSetupRecord } from './gate.mjs';

export async function getPassphrase(db) {
  const raw = (await getSetting(db, 'backup_full', {})).passphrase; if (!raw) return '';
  try { return unseal(raw); } catch { return ''; }
}
const same = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
const store = async (db, pass) => setSetting(db, 'backup_full', { ...(await getSetting(db, 'backup_full', {})), passphrase: seal(pass) });
const remember = async (db, action) => { const rec = await getSetupRecord(db), history = [...(rec?.passphraseHistory || []), { at: Date.now(), action }].slice(-50); await updateSetupRecord(db, { passphraseHistory: history, passphraseConfirmed: true }); };
function validNew(next, confirm, saved) {
  if (typeof next !== 'string' || next.length < MIN_PASSPHRASE) throw coded('HOST_BACKUP_PASSPHRASE_SHORT');
  if (next !== confirm) throw coded('HOST_BACKUP_PASSPHRASE_MISMATCH');
  if (saved !== true) throw coded('HOST_BACKUP_PASSPHRASE_UNSAVED');
}

// Does what was typed match the saved passphrase? Answers yes or no and nothing else.
export async function checkPassphrase(db, typed, actor) {
  const cur = await getPassphrase(db); if (!cur) throw coded('HOST_BACKUP_PASSPHRASE_NONE');
  const match = typeof typed === 'string' && typed.length > 0 && same(typed, cur);
  audit('backup.passphrase_check', `Backup passphrase check: ${match ? 'it matches the saved passphrase' : 'it does NOT match the saved passphrase'}`, { actor, level: match ? 'info' : 'warn', data: { match } });
  return { match };
}
// Change: needs the current passphrase. Future copies use the new one; older copies still need the old one.
export async function changePassphrase(db, { current = '', next = '', confirm = '', saved = false } = {}, actor) {
  const cur = await getPassphrase(db); if (!cur) throw coded('HOST_BACKUP_PASSPHRASE_NONE');
  if (typeof current !== 'string' || !current || !same(current, cur)) {
    audit('backup.passphrase_change', 'Backup passphrase change refused: the current passphrase typed was wrong', { actor, level: 'warn', data: { ok: false, reason: 'wrong_current' } });
    throw coded('HOST_BACKUP_PASSPHRASE_WRONG');
  }
  validNew(next, confirm, saved);
  if (same(next, cur)) throw coded('HOST_BACKUP_PASSPHRASE_SAME');
  await store(db, next); await remember(db, 'change');
  audit('backup.passphrase_change', 'Backup passphrase changed. New copies use the new passphrase; older copies still need the old one', { actor, data: { ok: true } });
  return { ok: true };
}
// Reset (forgotten): no current passphrase needed, so every older encrypted copy can never be opened again. Needs the warning acknowledged.
export async function resetPassphrase(db, { next = '', confirm = '', saved = false, acknowledge = false } = {}, actor) {
  if (!(await getPassphrase(db)) && !(await getSetting(db, 'backup_full', {})).passphrase) throw coded('HOST_BACKUP_PASSPHRASE_NONE');
  if (acknowledge !== true) throw coded('HOST_BACKUP_RESET_UNACK');
  validNew(next, confirm, saved);
  await store(db, next); await remember(db, 'reset');
  audit('backup.passphrase_reset', 'Backup passphrase RESET (forgotten). Every older encrypted copy can never be opened', { actor, level: 'warn', data: { ok: true } });
  return { ok: true };
}
// When a copy cannot be opened: was it taken before the passphrase last changed? Returns a plain sentence, or '' when that does not explain it.
export async function earlierPassphraseNote(db, takenAt) {
  const h = (await getSetupRecord(db))?.passphraseHistory || [], last = [...h].reverse().find(x => x.at > Number(takenAt || 0)); if (!last) return '';
  const when = new Date(last.at).toISOString().slice(0, 10);
  return last.action === 'reset'
    ? `This copy was made with an earlier passphrase: the passphrase was reset on ${when}, after this copy was taken. It can only be opened with the passphrase that was current then.`
    : `This copy was made with an earlier passphrase: the passphrase was changed on ${when}, after this copy was taken. Type the passphrase that was current then and test again.`;
}
