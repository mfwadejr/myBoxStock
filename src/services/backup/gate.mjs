// SERVICES / backup / gate — the Backup setup record and the hard gate that stops anything depending on the passphrase from being turned on first.
// Installs that already had a passphrase before the guided setup existed are "legacy": their setup shows as complete and nothing they use is locked.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { MSG } from '../../core/messages.mjs';

const KEY = 'backup_setup';
// An Error that carries one of the codes in core/messages.mjs; routes turn it into fail(res, status, code).
export const coded = (code) => Object.assign(new Error(MSG[code] || code), { code });
const hasPassphrase = async (db) => !!(await getSetting(db, 'backup_full', {})).passphrase;

export const getSetupRecord = (db) => getSetting(db, KEY, null);
// Changes the record (creating it on first use). A record made on an install that already had a passphrase is marked legacy once, here.
export async function updateSetupRecord(db, patch) {
  const cur = await getSetupRecord(db) || { legacy: await hasPassphrase(db), passphraseConfirmed: false, offServer: null, keepChoice: null, proven: null, offsiteVerified: null };
  const next = { ...cur, ...patch }; await setSetting(db, KEY, next); return next;
}
// True when step 1 is finished: a passphrase exists and, on installs that used the guided setup, the Host confirmed it is saved elsewhere.
export async function passphraseReady(db) {
  if (!(await hasPassphrase(db))) return false;
  const rec = await getSetupRecord(db);
  return rec ? !!(rec.legacy || rec.passphraseConfirmed) : true;
}
// Throws the plain reason when a passphrase exists but step 1 is not finished. The "no passphrase at all" messages stay with the callers.
export async function assertPassphraseReady(db) {
  if (await hasPassphrase(db) && !(await passphraseReady(db))) throw coded('HOST_BACKUP_PASSPHRASE_FIRST');
}
