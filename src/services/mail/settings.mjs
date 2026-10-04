// SERVICES / mail / settings — outbound email configuration (SMTP password encrypted at rest).
import { getSetting, setSetting } from '../../db/settings.mjs';
import { seal, unseal } from '../../auth/secrets.mjs';
import { areaLogger } from '../../logging/logger.mjs';

const L = areaLogger('mail');
export const DEFAULT_MAIL = { enabled: false, mode: 'direct', fromName: 'myBoxStock', fromAddress: '', heloName: '', smtp: { host: '', port: 587, secure: false, user: '', pass: '' } };

export async function getMailSettings(db, { reveal = false } = {}) {
  const m = { ...DEFAULT_MAIL, ...(await getSetting(db, 'mail', {})) };
  m.smtp = { ...DEFAULT_MAIL.smtp, ...m.smtp };
  if (!reveal) m.smtp = { ...m.smtp, pass: m.smtp.pass ? '********' : '' };
  else if (m.smtp.pass) { try { m.smtp.pass = unseal(m.smtp.pass); } catch { m.smtp.pass = ''; L.error('settings.decrypt_failed', 'Could not decrypt the SMTP password (was the encryption key changed?)'); } }
  return m;
}
// TLS from the start of the connection always means port 465; otherwise the port is the one the relay gave (usually 587, which upgrades with STARTTLS).
export function checkSmtp(s = {}) {
  const secure = !!s.secure, port = secure ? 465 : Number(s.port || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: 'Enter a port between 1 and 65535 (usually 587).' };
  if (!secure && port === 465) return { error: 'Port 465 needs “Use TLS from the start of the connection” turned on. Use 587 otherwise.' };
  return { secure, port };
}
export async function saveMailSettings(db, patch, actor) {
  const raw = { ...DEFAULT_MAIL, ...(await getSetting(db, 'mail', {})) }, cur = await getMailSettings(db), s = patch.smtp || {};
  const next = {
    enabled: !!patch.enabled, mode: patch.mode === 'smtp' ? 'smtp' : 'direct',
    fromName: String(patch.fromName || cur.fromName).slice(0, 100), fromAddress: String(patch.fromAddress || '').slice(0, 200), heloName: String(patch.heloName || '').slice(0, 200),
    smtp: { host: String(s.host || '').slice(0, 200), port: checkSmtp(s).port, secure: !!s.secure, user: String(s.user || '').slice(0, 200), pass: s.pass && s.pass !== '********' ? seal(String(s.pass)) : (raw.smtp?.pass || '') },
  };
  await setSetting(db, 'mail', next);
  L.info('settings.saved', `Email settings saved (${next.enabled ? 'on' : 'off'}, ${next.mode}, from ${next.fromAddress || 'unset'})`, { actor, data: { enabled: next.enabled, mode: next.mode, fromAddress: next.fromAddress, smtpHost: next.smtp.host, smtpPort: next.smtp.port, passwordChanged: !!s.pass && s.pass !== '********' } });
}
