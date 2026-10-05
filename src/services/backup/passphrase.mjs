// SERVICES / backup / passphrase — reads the backup passphrase kept sealed in the full-site settings (never logged, never sent to the browser).
import { getSetting } from '../../db/settings.mjs';
import { unseal } from '../../auth/secrets.mjs';

export async function getPassphrase(db) {
  const raw = (await getSetting(db, 'backup_full', {})).passphrase; if (!raw) return '';
  try { return unseal(raw); } catch { return ''; }
}
