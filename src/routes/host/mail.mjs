// ROUTES / host / mail — email settings, test message, recent queue.
import express from 'express';
import { hostLog } from './context.mjs';
import { getMailSettings, saveMailSettings, enqueueMail, processQueue } from '../../services/mail/index.mjs';
import { checkSmtp } from '../../services/mail/settings.mjs';
import { TEMPLATES, PLACEHOLDERS, EDITABLE, defaultsOf, wording, problems, render, sampleVars } from '../../services/mail/templates.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { newId } from '../../core/ids.mjs';
import { checkSender, cleanSelector } from '../../services/mail/sender-checks.mjs';
import { runMailCheck, saveLastTest, mailTestStatus, logTest, scrub } from '../../services/mail/diagnose.mjs';

const QUEUE_SQL = 'SELECT id, to_addr, subject, status, attempts, last_error, created_at, sent_at FROM mail_queue ORDER BY created_at DESC LIMIT 30';

const draftOf = (b = {}) => Object.fromEntries(EDITABLE.map(k => [k, typeof b[k] === 'string' ? b[k] : '']));
const previews = new Map(); // short-lived rendered drafts, so the preview frame can load them as a real page with its own security headers

export function mailRoutes(db, { resolver } = {}) {   // resolver: the DNS client for the sender checks (tests pass a fake)
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ settings: await getMailSettings(db),
    queue: await db.all(QUEUE_SQL) }));

  // Email health: is mail getting out? Counts and times only; no message content.
  r.get('/health', async (req, res) => {
    const now = Date.now(), H = 3600e3, n = async (sql, a = []) => Number((await db.get(sql, a)).n);
    const settings = await getMailSettings(db), lastSent = await db.get("SELECT sent_at FROM mail_queue WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 1"), lastFail = await db.get("SELECT created_at, last_error FROM mail_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1");
    const oldest = await db.get("SELECT created_at FROM mail_queue WHERE status = 'queued' ORDER BY created_at LIMIT 1");
    res.json({ enabled: !!settings.enabled, mode: settings.mode, fromAddress: settings.fromAddress,
      lastSentAt: lastSent?.sent_at ? Number(lastSent.sent_at) : null, lastFailureAt: lastFail ? Number(lastFail.created_at) : null, lastError: lastFail?.last_error || '',
      sent24h: await n("SELECT COUNT(*) AS n FROM mail_queue WHERE status = 'sent' AND sent_at > ?", [now - 24 * H]), failed24h: await n("SELECT COUNT(*) AS n FROM mail_queue WHERE status = 'failed' AND created_at > ?", [now - 24 * H]),
      sent7d: await n("SELECT COUNT(*) AS n FROM mail_queue WHERE status = 'sent' AND sent_at > ?", [now - 168 * H]), failed7d: await n("SELECT COUNT(*) AS n FROM mail_queue WHERE status = 'failed' AND created_at > ?", [now - 168 * H]),
      queued: await n("SELECT COUNT(*) AS n FROM mail_queue WHERE status = 'queued'"), oldestQueuedAt: oldest ? Number(oldest.created_at) : null, test: await mailTestStatus(db) });
  });

  // Sender checks: SPF, DMARC and DKIM records of the From address's domain. Public DNS facts only.
  r.get('/sender-checks', async (req, res) => {
    const sel = String(req.query.selector || '').trim(); if (sel && !cleanSelector(sel)) return res.status(400).json({ error: 'A DKIM selector is letters, numbers, dots and dashes only (for example: default).' });
    const result = await checkSender({ fromAddress: (await getMailSettings(db)).fromAddress, selector: sel }, resolver);
    if (result.domain) hostLog(req, 'info', 'mail.sender_check', `Sender checks for ${result.domain}: SPF ${result.spf.status}, DMARC ${result.dmarc.status}, DKIM ${result.dkim.status}`, { area: 'mail', data: { domain: result.domain, spf: result.spf.status, dmarc: result.dmarc.status, dkim: result.dkim.status } });
    res.json(result);
  });

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
  // "Send test email" and "Check my email setup": the settings, the connection, the sign-in and the send, in order, with a plain-language cause and next step when one fails.
  // The result (never the password) is remembered, and the history row of the test message appears under Recent messages.
  const check = async (req, res) => {
    const to = String(req.body?.to || req.subject.email || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ error: 'Enter a valid recipient address.' });
    const result = await runMailCheck(db, { to, resolver, greetingMs: Number(process.env.MAIL_GREETING_MS) || 6000 }), ok = result.ok || (result.warning && !result.failure);
    // Every test leaves a line under Recent messages (sent, or failed with the plain reason), using the saved wording of the Test message.
    const msg = render('test', {}, (await getSetting(db, 'mail_templates', {})).test);
    await db.run('INSERT INTO mail_queue (id,to_addr,subject,body_text,body_html,status,attempts,last_error,created_at,sent_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [newId(), to, msg.subject, msg.text, msg.html, ok ? 'sent' : 'failed', 1, ok ? null : scrub(`${result.failure.title}. ${result.failure.detail}`).slice(0, 500), result.at, ok ? Date.now() : null]);
    const saved = await saveLastTest(db, result); logTest(result, req.subject.username, req.ip);
    hostLog(req, result.ok ? 'info' : 'warn', 'mail.test', `Test email to ${to}: ${result.ok ? 'sent' : `not sent (${result.failure.title})`}`, { data: { to, status: result.ok ? 'sent' : 'failed', kind: result.failure?.kind || null } });
    res.json({ ok: result.ok, status: result.ok ? 'sent' : 'failed', error: result.failure ? `${result.failure.title}. ${result.failure.cause}` : '', result, last: { at: saved.at, ok: saved.ok, title: saved.title } });
  };
  r.post('/test', check);
  r.post('/check', check);
  // The last test, and whether one has passed since the settings last changed.
  r.get('/test-status', async (req, res) => res.json(await mailTestStatus(db)));
  return r;
}
