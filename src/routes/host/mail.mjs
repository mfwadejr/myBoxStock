// ROUTES / host / mail — email settings, test message, recent queue.
import express from 'express';
import { hostLog } from './context.mjs';
import { getMailSettings, saveMailSettings, enqueueMail, processQueue } from '../../services/mail/index.mjs';
import { checkSmtp } from '../../services/mail/settings.mjs';
import { TEMPLATES, PLACEHOLDERS, EDITABLE, defaultsOf, wording, problems, render, sampleVars } from '../../services/mail/templates.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { newId } from '../../core/ids.mjs';

const QUEUE_SQL = 'SELECT id, to_addr, subject, status, attempts, last_error, created_at, sent_at FROM mail_queue ORDER BY created_at DESC LIMIT 30';

const draftOf = (b = {}) => Object.fromEntries(EDITABLE.map(k => [k, typeof b[k] === 'string' ? b[k] : '']));
const previews = new Map(); // short-lived rendered drafts, so the preview frame can load them as a real page with its own security headers

export function mailRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ settings: await getMailSettings(db),
    queue: await db.all(QUEUE_SQL) }));

  // ---- message wording (Messages tab) ----
  const info = (key, saved) => { const t = TEMPLATES[key], d = defaultsOf(t), cur = wording(key, saved[key]);
    return { key, group: t.group, name: t.name, hasButton: !!t.button, defaults: d, current: cur, custom: EDITABLE.some(k => cur[k] !== d[k]),
      placeholders: [...t.vars, ...(t.button ? [t.button.to] : [])].filter((k, i, a) => a.indexOf(k) === i && !(t.button && k === t.button.to)).map(k => ({ key: k, label: PLACEHOLDERS[k].label, required: t.required.includes(k) })) }; };
  r.get('/templates', async (req, res) => { const saved = await getSetting(db, 'mail_templates', {}); res.json({ templates: Object.keys(TEMPLATES).map(k => info(k, saved)) }); });
  // Renders a draft with sample details; the styled version is fetched by the preview frame from /templates/preview/:token.
  r.post('/templates/:key/preview', (req, res) => {
    const key = req.params.key; if (!TEMPLATES[key]) return res.status(404).json({ error: 'Unknown message.' });
    const w = draftOf(req.body), m = render(key, sampleVars(), w), token = newId();
    previews.set(token, m.html); while (previews.size > 40) previews.delete(previews.keys().next().value);
    res.json({ subject: m.subject, text: m.text, token, problems: problems(key, { ...wording(key, null), ...w }) });
  });
  r.get('/templates/preview/:token', (req, res) => {
    const html = previews.get(String(req.params.token)); if (!html) return res.status(404).send('Preview expired.');
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' });
    res.send(html.replace('cid:mbs-logo', '/assets/logo-email.png'));
  });
  r.put('/templates/:key', async (req, res) => {
    const key = req.params.key, t = TEMPLATES[key]; if (!t) return res.status(404).json({ error: 'Unknown message.' });
    const w = draftOf(req.body); if (!t.button) w.buttonLabel = '';
    const bad = problems(key, { ...wording(key, null), ...w }); if (bad.length) return res.status(400).json({ error: bad[0] });
    const saved = await getSetting(db, 'mail_templates', {}), d = defaultsOf(t), diff = Object.fromEntries(EDITABLE.filter(k => w[k] !== d[k] && (k !== 'buttonLabel' || t.button)).map(k => [k, w[k]]));
    if (Object.keys(diff).length) saved[key] = diff; else delete saved[key];
    await setSetting(db, 'mail_templates', saved);
    hostLog(req, 'info', 'mail.template', `Email message "${t.name}" ${saved[key] ? 'wording changed' : 'reset to the default wording'}`, { data: { template: key } });
    res.json({ ok: true, template: info(key, saved) });
  });
  r.delete('/templates/:key', async (req, res) => {
    const key = req.params.key, t = TEMPLATES[key]; if (!t) return res.status(404).json({ error: 'Unknown message.' });
    const saved = await getSetting(db, 'mail_templates', {}); delete saved[key]; await setSetting(db, 'mail_templates', saved);
    hostLog(req, 'info', 'mail.template', `Email message "${t.name}" reset to the default wording`, { data: { template: key } });
    res.json({ ok: true, template: info(key, saved) });
  });
  // Sends the draft (with sample details) to one address so it can be seen in a real mail app.
  r.post('/templates/:key/test', async (req, res) => {
    const key = req.params.key, t = TEMPLATES[key]; if (!t) return res.status(404).json({ error: 'Unknown message.' });
    const to = String(req.body.to || req.subject.email || ''); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ error: 'Enter a valid recipient address.' });
    const w = draftOf(req.body), bad = problems(key, { ...wording(key, null), ...w }); if (bad.length) return res.status(400).json({ error: bad[0] });
    const id = await enqueueMail(db, to, key, sampleVars(), { override: w, subjectPrefix: '[Test] ' }); await processQueue(db);
    const last = await db.get('SELECT status, last_error FROM mail_queue WHERE id = ?', [id]);
    hostLog(req, last.status === 'sent' ? 'info' : 'warn', 'mail.test', `Test of "${t.name}" to ${to}: ${last.status}${last.last_error ? ` — ${last.last_error}` : ''}`, { data: { to, template: key, status: last.status } });
    res.json({ ok: last.status === 'sent', status: last.status, error: last.last_error });
  });
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
