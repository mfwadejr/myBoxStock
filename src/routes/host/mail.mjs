// ROUTES / host / mail — email settings, test message, recent queue.
import express from 'express';
import { hostLog } from './context.mjs';
import { getMailSettings, saveMailSettings, enqueueMail, processQueue } from '../../services/mail/index.mjs';

export function mailRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ settings: await getMailSettings(db),
    queue: await db.all('SELECT id, to_addr, subject, status, attempts, last_error, created_at, sent_at FROM mail_queue ORDER BY created_at DESC LIMIT 30') }));
  r.put('/', async (req, res) => { await saveMailSettings(db, req.body, req.subject.username); res.json({ ok: true }); });
  r.post('/test', async (req, res) => {
    const to = String(req.body.to || req.subject.email || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ error: 'Enter a valid recipient address.' });
    const id = await enqueueMail(db, to, 'test'); await processQueue(db);
    const last = await db.get('SELECT status, last_error FROM mail_queue WHERE id = ?', [id]);
    hostLog(req, last.status === 'sent' ? 'info' : 'warn', 'mail.test', `Test email to ${to}: ${last.status}${last.last_error ? ` — ${last.last_error}` : ''}`, { data: { to, status: last.status } });
    res.json({ ok: last.status === 'sent', status: last.status, error: last.last_error });
  });
  return r;
}
