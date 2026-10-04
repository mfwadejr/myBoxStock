// ROUTES / host / mail — email settings, test message, recent queue.
import express from 'express';
import { hostLog } from './context.mjs';
import { getMailSettings, saveMailSettings, enqueueMail, processQueue } from '../../services/mail/index.mjs';
import { checkSmtp } from '../../services/mail/settings.mjs';

const QUEUE_SQL = 'SELECT id, to_addr, subject, status, attempts, last_error, created_at, sent_at FROM mail_queue ORDER BY created_at DESC LIMIT 30';

export function mailRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ settings: await getMailSettings(db),
    queue: await db.all(QUEUE_SQL) }));
  r.get('/queue', async (req, res) => res.json({ queue: await db.all(QUEUE_SQL) }));
  // Put failed messages back in the queue and try them now.
  const resend = async (req, res, where, args, what) => {
    const ids = (await db.all(`SELECT id FROM mail_queue WHERE status = 'failed' ${where}`, args)).map(x => x.id);
    for (const id of ids) await db.run("UPDATE mail_queue SET status='queued', attempts=0, last_error=NULL WHERE id=?", [id]);
    hostLog(req, 'info', 'mail.resend', `${what}: ${ids.length} failed message${ids.length === 1 ? '' : 's'} sent back to the queue`, { data: { count: ids.length } });
    processQueue(db).catch(() => {}); res.json({ ok: true, count: ids.length });
  };
  r.post('/resend-failed', (req, res) => resend(req, res, '', [], 'Resend all'));
  r.post('/:id/resend', (req, res) => resend(req, res, 'AND id = ?', [String(req.params.id)], 'Resend'));
  r.put('/', async (req, res) => {
    const chk = checkSmtp(req.body?.smtp); if (chk.error && req.body?.mode === 'smtp') return res.status(400).json({ error: chk.error }); await saveMailSettings(db, req.body, req.subject.username); res.json({ ok: true }); });
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
