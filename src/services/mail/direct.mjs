// SERVICES / mail / direct — send one message right now without saving it. Used for receipts: the address and the content pass
// through the server but are never written to the mail queue, the database or the logs.
import { getMailSettings } from './settings.mjs';
import { transportFor } from './transport.mjs';
import { LOGO_CID } from './theme.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOGO_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'assets', 'logo-email.png');
const clean = (s) => String(s || '').replace(/[\r\n"<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export async function mailReady(db) { const m = await getMailSettings(db); return !!(m.enabled && m.fromAddress); }

// { to, subject, text, html, replyTo, businessName } -> resolves when handed to the mail server; throws on failure.
export async function sendDirect(db, { to, subject, text, html, replyTo, businessName }) {
  const settings = await getMailSettings(db, { reveal: true });
  if (!settings.enabled || !settings.fromAddress) throw new Error('mail_off');
  const { transport } = await transportFor(settings, to);
  await transport.sendMail({ from: `"${clean(businessName) || settings.fromName} via ${settings.fromName}" <${settings.fromAddress}>`, to, subject, text, html, ...(replyTo ? { replyTo } : {}), attachments: [{ filename: 'myboxstock.png', path: LOGO_FILE, cid: LOGO_CID }] });
}
