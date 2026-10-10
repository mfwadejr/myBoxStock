// SERVICES / accounts / bulk — bulk actions on selected accounts from the Host's Accounts page.
// Actions (none of them destructive: no suspend, close or delete): extend_trial, change_plan, announce (in-app notice, optionally email), export (CSV of Host-visible fields).
// Every action first PREVIEWS what it would change; anything that changes accounts needs the typed confirmation shown in the preview; a large selection runs as a
// background job with progress; each account gets its own audit entry and the whole run gets a summary entry. Customer data is never read: identity, plan and security columns only.
import { newId } from '../../core/ids.mjs';
import { log } from '../../logging/logger.mjs';
import { setPlan } from '../billing/index.mjs';
import { enqueueMail, processQueue, mailReady } from '../mail/index.mjs';
import { saveAccountNotice, LEVELS, MAX_TEXT } from '../announcement/index.mjs';
import { siteUrl } from '../site/index.mjs';
import { listAccounts, accountsByIds, LIST_LIMIT } from './list.mjs';

export const ACTIONS = ['extend_trial', 'change_plan', 'announce', 'export'];
export const BULK_MAX = 1000;        // most accounts one bulk action may touch
export const LARGE_AT = 25;          // this many accounts or more run as a background job with a progress strip
export const EMAIL_CAP = 500;        // most announcement emails one bulk action may queue
export const VERB = { extend_trial: 'EXTEND', change_plan: 'CHANGE', announce: 'SEND' };
const err = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });

// Demo accounts (Demo mode) can be selected and are labelled, but never receive email. The flag is the `demo` column once Demo mode exists; today no account has it.
export const isDemo = (a) => !!a.demo;

// Selection -> the accounts: { ids: [...] } or { all: true, query: {q, plan, health, attentionDays} } (everything the list shows for that search and filter).
export async function resolveTargets(db, selection = {}, now = Date.now()) {
  let rows;
  if (selection.all) rows = await listAccounts(db, selection.query || {}, { limit: LIST_LIMIT, now });
  else {
    const ids = [...new Set((Array.isArray(selection.ids) ? selection.ids : []).map(String))];
    if (ids.length > BULK_MAX) throw err('BULK_TOO_MANY');
    rows = await accountsByIds(db, ids, now);
  }
  if (!rows.length) throw err('BULK_NONE');
  if (rows.length > BULK_MAX) throw err('BULK_TOO_MANY');
  return rows;
}

const days = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 365 ? n : 0; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const PLAN_WORD = { free: 'Free', trial: 'a trial', paid: 'Paid' };

// Cleans the action's settings (throws BULK_BAD_INPUT) and works out which of the targets it applies to and why the others are skipped.
export function plan(action, params = {}, targets) {
  if (!ACTIONS.includes(action)) throw err('BULK_BAD_ACTION');
  const skipped = {}, skip = (why) => { skipped[why] = (skipped[why] || 0) + 1; };
  let applies = targets, p = {}, text = '';
  if (action === 'extend_trial') {
    const d = days(params.days); if (!d) throw err('BULK_BAD_INPUT');
    p = { days: d }; applies = targets.filter(a => a.billing.state === 'trial' || (skip('not on a running trial'), false));
    text = `This will extend ${plural(applies.length, 'trial')} by ${plural(d, 'day')}.`;
  } else if (action === 'change_plan') {
    const to = String(params.plan || 'keep'), note = String(params.note || '').trim().slice(0, 255);
    if (!['keep', 'free', 'trial', 'paid'].includes(to) || (to === 'keep' && note.length < 3)) throw err('BULK_BAD_INPUT');
    p = { plan: to, note };
    if (to === 'trial') { const d = days(params.days); if (!d) throw err('BULK_BAD_INPUT'); p.days = d; }
    if (to === 'paid' && params.until) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(params.until)) || Number.isNaN(Date.parse(params.until))) throw err('BULK_BAD_INPUT'); p.until = String(params.until); }
    applies = targets.filter(a => !(to === 'free' && a.plan === 'free') || (skip('already Free'), false));
    text = to === 'keep' ? `This will change the plan note on ${plural(applies.length, 'account')}. Plans and dates stay as they are.`
      : `This will change ${plural(applies.length, 'account')} to ${PLAN_WORD[to]}${to === 'trial' ? ` (${plural(p.days, 'day')} from today)` : to === 'paid' && p.until ? ` (paid through ${p.until})` : ''}.`;
  } else if (action === 'announce') {
    const t = String(params.text || '').trim(), level = String(params.level || 'info');
    if (t.length < 5 || t.length > MAX_TEXT || !LEVELS.includes(level)) throw err('BULK_BAD_INPUT');
    p = { text: t, level, email: !!params.email };
    const mails = p.email ? applies.filter(a => a.owner_email && !isDemo(a)).length : 0;
    if (p.email) { const noMail = applies.filter(a => !a.owner_email).length, demo = applies.filter(isDemo).length; if (noMail) skipped['no owner email (notice only)'] = noMail; if (demo) skipped['Demo accounts never get email (notice only)'] = demo; }
    text = `This will show your notice to ${plural(applies.length, 'account')}${p.email ? ` and email ${plural(mails, 'owner')}` : ''}.`; p.mails = mails;
  } else text = `This will export ${plural(applies.length, 'account')} to a CSV file. Nothing is changed.`;
  return { params: p, applies, skipped, text };
}

export const phraseFor = (action, n) => (VERB[action] ? `${VERB[action]} ${n}` : '');

export async function preview(db, action, params, selection) {
  const targets = await resolveTargets(db, selection), pl = plan(action, params, targets);
  return {
    action, selected: targets.length, count: pl.applies.length, text: pl.text, skipped: Object.entries(pl.skipped).map(([reason, n]) => ({ reason, count: n })),
    confirm: pl.applies.length ? phraseFor(action, pl.applies.length) : '', asJob: pl.applies.length >= LARGE_AT, emails: pl.params.mails || 0, demo: pl.applies.filter(isDemo).length,
    sample: pl.applies.slice(0, 5).map(a => ({ name: a.business_name, code: a.account_code })),
  };
}

// ---- the work, one account at a time ----
async function applyOne(db, action, p, a, ctx) {
  if (action === 'extend_trial') {
    const b = await setPlan(db, a, { plan: 'trial', days: p.days, extend: true, note: ctx.reason, actor: ctx.actor });
    return `Trial extended by ${plural(p.days, 'day')} (now ${b.daysLeft} days left)`;
  }
  if (action === 'change_plan') {
    if (p.plan === 'keep') { await db.run('UPDATE accounts SET plan_note = ?, plan_changed_at = ? WHERE id = ?', [p.note, Date.now(), a.id]); return 'Plan note changed'; }
    await setPlan(db, a, { plan: p.plan, days: p.days, until: p.until, extend: false, note: p.note || ctx.reason, actor: ctx.actor });
    return `Plan changed from ${a.plan} to ${p.plan}`;
  }
  if (action === 'announce') {
    await saveAccountNotice(db, a.id, p);
    if (p.email && a.owner_email && !isDemo(a)) { await enqueueMail(db, a.owner_email, 'host_announcement', { name: a.business_name, notice: p.text, url: await siteUrl(db).catch(() => '') }); ctx.mailed++; return 'Notice shown and email queued'; }
    return 'Notice shown';
  }
  return 'Included in the export';
}

// Runs the action on the accounts it applies to. Returns { done, failed, skipped, summary, csv? }. Writes the audit entries.
export async function execute(db, action, params, targets, { actor, ip = null, reason = '', progress = () => {}, runId = newId() } = {}) {
  const pl = plan(action, params, targets), ctx = { actor, reason, mailed: 0 };
  let done = 0, failed = 0;
  const skippedN = targets.length - pl.applies.length;
  const entry = (level, a, msg, extra = {}) => log('accounts', level, `bulk.${action}`, `Account ${a.account_code}: ${msg}`, { actor, ip, accountId: a.id, data: { code: a.account_code, bulk: runId, reason: reason || undefined, ...extra } });
  for (let i = 0; i < pl.applies.length; i++) {
    const a = pl.applies[i];
    try { const msg = action === 'export' ? 'Included in the export' : await applyOne(db, action, pl.params, a, ctx); entry('info', a, `${msg} (bulk)`); done++; }
    catch (e) { failed++; entry('warn', a, `Bulk action failed: ${String(e.message).slice(0, 150)}`, { failed: true }); }
    progress(i + 1, pl.applies.length);
    if (i % 20 === 19) await new Promise(r => setImmediate(r));
  }
  if (ctx.mailed) processQueue(db).catch(() => {});
  const label = { extend_trial: 'Extend trial', change_plan: 'Change plan', announce: 'Send announcement', export: 'Export list' }[action];
  const summary = `${label}: ${plural(done, 'account')} done${failed ? `, ${failed} failed` : ''}${skippedN ? `, ${skippedN} skipped` : ''}.`;
  log('host', failed ? 'warn' : 'info', 'bulk.summary', `Bulk action ${summary}${reason ? ` Reason: ${reason}` : ''}`, { actor, ip, data: { bulk: runId, action, selected: targets.length, done, failed, skipped: skippedN, emails: ctx.mailed, reason: reason || undefined } });
  return { ok: !failed, done, failed, skipped: skippedN, emails: ctx.mailed, summary, runId, ...(action === 'export' ? { csv: toCsv(pl.applies) } : {}) };
}

// ---- CSV: Host-visible fields only ----
const safe = (v) => { const s = v == null ? '' : String(v); const t = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const iso = (ms) => (ms ? new Date(Number(ms)).toISOString().slice(0, 10) : '');
export const CSV_HEADER = ['Business', 'Reseller ID', 'Owner email', 'Status', 'Plan', 'Plan ends', 'Days left', 'Users', 'Last sign-in', 'Created'];
export function toCsv(rows) {
  const lines = [CSV_HEADER.map(safe).join(',')];
  for (const a of rows) lines.push([a.business_name, a.account_code, a.owner_email, a.closing_at ? 'closing' : a.status, a.billing.state, iso(a.billing.endsAt), a.billing.daysLeft ?? '', a.user_count ?? '', iso(a.last_login), iso(a.created_at)].map(safe).join(','));
  return lines.join('\r\n') + '\r\n';
}

// ---- background job: one at a time, polled by the page ----
let current = null;
export const currentBulkJob = () => current;
export const publicBulkJob = (j) => j && ({ id: j.id, action: j.action, label: j.label, status: j.status, done: j.done, total: j.total, pct: j.total ? Math.round(j.done / j.total * 100) : 0, ok: j.ok, summary: j.summary, error: j.error, startedAt: j.startedAt, finishedAt: j.finishedAt, actor: j.actor });
export const dismissBulkJob = (id) => { if (current && current.id === id && current.status !== 'running') { current = null; return true; } return false; };
export const resetBulkForTests = () => { current = null; };
export function startBulkJob(db, action, params, targets, opts) {
  if (current && current.status === 'running') throw err('BULK_JOB_RUNNING');
  const j = { id: newId(), action, label: `Bulk action: ${action.replace('_', ' ')}`, status: 'running', done: 0, total: targets.length, ok: null, summary: '', error: null, startedAt: Date.now(), finishedAt: null, actor: opts.actor };
  current = j;
  execute(db, action, params, targets, { ...opts, progress: (d, t) => { j.done = d; j.total = t; } })
    .then((r) => { j.status = 'done'; j.ok = r.ok; j.summary = r.summary; j.finishedAt = Date.now(); })
    .catch((e) => { j.status = 'failed'; j.ok = false; j.error = String(e.message).slice(0, 300); j.summary = 'The bulk action stopped with a problem. Check the audit trail for what was done.'; j.finishedAt = Date.now(); log('host', 'error', 'bulk.summary', `Bulk action ${action} stopped: ${j.error}`, { actor: opts.actor, ip: opts.ip, data: { bulk: opts.runId, action, failed: true } }); });
  return j;
}
export { mailReady };
