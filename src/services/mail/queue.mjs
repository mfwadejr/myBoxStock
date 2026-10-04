// SERVICES / mail / queue — enqueue messages, deliver them with retries, never block a web request.
import { newId } from '../../core/ids.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { getMailSettings } from './settings.mjs';
import { render } from './templates.mjs';
import { transportFor } from './transport.mjs';
import { LOGO_CID } from './theme.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOGO_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'assets', 'logo-email.png');

const L = areaLogger('mail');
const MAX_ATTEMPTS = 5;

export async function enqueueMail(db, to, template, vars = {}) {
  const m = render(template, vars), id = newId();
  await db.run('INSERT INTO mail_queue (id,to_addr,subject,body_text,body_html,status,attempts,created_at) VALUES (?,?,?,?,?,?,0,?)', [id, to, m.subject, m.text, m.html, 'queued', Date.now()]);
  L.info('queued', `Queued "${template}" email to ${to}`, { data: { id, template, to } });
  return id;
}

async function deliver(db, row) {
  const settings = await getMailSettings(db, { reveal: true });
  if (!settings.enabled) throw new Error('Outbound email is disabled in Host settings.');
  if (!settings.fromAddress) throw new Error('Set a From address first.');
  const { transport, via } = await transportFor(settings, row.to_addr);
  await transport.sendMail({ from: `"${settings.fromName}" <${settings.fromAddress}>`, to: row.to_addr, subject: row.subject, text: row.body_text, html: row.body_html, attachments: [{ filename: 'myboxstock.png', path: LOGO_FILE, cid: LOGO_CID, contentDisposition: 'inline' }] });
  return via;
}

let busy = false;
export async function processQueue(db) {
  if (busy) return; busy = true;
  try {
    for (const row of await db.all("SELECT * FROM mail_queue WHERE status = 'queued' ORDER BY created_at LIMIT 20")) {
      try {
        const via = await deliver(db, row);
        await db.run("UPDATE mail_queue SET status='sent', sent_at=?, attempts=attempts+1, last_error=NULL WHERE id=?", [Date.now(), row.id]);
        L.info('sent', `Delivered "${row.subject}" to ${row.to_addr} via ${via}`, { data: { id: row.id, to: row.to_addr, via } });
      } catch (e) {
        const attempts = row.attempts + 1, final = attempts >= MAX_ATTEMPTS;
        await db.run('UPDATE mail_queue SET status=?, attempts=?, last_error=? WHERE id=?', [final ? 'failed' : 'queued', attempts, String(e.message).slice(0, 500), row.id]);
        L[final ? 'error' : 'warn'](final ? 'failed' : 'retry', `${final ? 'Gave up on' : 'Failed to send'} "${row.subject}" to ${row.to_addr} (attempt ${attempts}/${MAX_ATTEMPTS}): ${e.message}`, { data: { id: row.id, to: row.to_addr, attempts, error: e.message } });
      }
    }
  } finally { busy = false; }
}
export function startMailWorker(db) { setInterval(() => processQueue(db).catch(e => L.error('worker.error', e.message)), 30000).unref(); L.info('worker.started', 'Mail queue worker started (every 30 s)'); }
