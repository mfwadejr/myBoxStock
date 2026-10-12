// ROUTES / host / business — run the business: signup and trial pipeline, renewals, and the plan list.
// Only Host-side facts (plan, dates, contact address). Never business data of an account.
import express from 'express';
import { hostLog } from './context.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { billingState, DAY } from '../../services/billing/state.mjs';
import { trialDays } from '../../services/billing/index.mjs';
import { enqueueMail, processQueue } from '../../services/mail/index.mjs';
import { siteUrl } from '../../services/site/index.mjs';
import { newId } from '../../core/ids.mjs';
import { mailReady } from '../../services/mail/index.mjs';
import { listDestinations } from '../../services/backup/destinations/index.mjs';
import { subscriptionStatus } from '../../services/billing/subscription.mjs';
import { getLimits, cleanLimits, limitNum } from '../../services/limits/index.mjs';


export function businessRoutes(db) {
  const r = express.Router();

  r.get('/pipeline', async (req, res) => {
    const now = Date.now(), rows = (await db.all(`SELECT a.id, a.account_code, a.business_name, a.owner_email, a.status, a.plan, a.trial_ends_at, a.plan_until, a.created_at, a.last_activity, a.demo,
      (SELECT MAX(u.last_login) FROM account_users u WHERE u.account_id = a.id) AS last_login FROM accounts a ORDER BY a.created_at DESC`)).map(x => ({ ...x, created_at: Number(x.created_at), last_activity: x.last_activity ? Number(x.last_activity) : null, last_login: x.last_login ? Number(x.last_login) : null, billing: billingState(x, now) }));
    const seen = (x) => Math.max(x.last_login || 0, x.last_activity || 0, x.created_at);
    // Follow-up: how many device records a trial has added (a count only, never what they hold), and when the last nudge email went out.
    const devs = new Map((await db.all("SELECT account_id, COUNT(*) AS n FROM records WHERE type = 'item' GROUP BY account_id")).map(x => [x.account_id, Number(x.n)]));
    const trials = rows.filter(x => x.billing.state === 'trial').map(x => ({ id: x.id, code: x.account_code, business: x.business_name, email: x.owner_email, daysLeft: x.billing.daysLeft, endsAt: x.billing.endsAt, lastSeen: seen(x), devices: devs.get(x.id) || 0, demo: !!x.demo })).sort((a, b) => a.daysLeft - b.daysLeft);
    const quiet = rows.filter(x => x.status === 'active' && x.billing.canWrite && now - seen(x) > 7 * DAY).map(x => ({ id: x.id, code: x.account_code, business: x.business_name, plan: x.billing.state, lastSeen: seen(x) })).sort((a, b) => a.lastSeen - b.lastSeen).slice(0, 50);
    // Where did the accounts that started on a trial end up? (current state of each)
    const outcome = { trial: 0, paid: 0, free: 0, ended: 0 };
    for (const x of rows) { const s = x.billing.state; if (s === 'trial') outcome.trial++; else if (s === 'paid') outcome.paid++; else if (s === 'free') outcome.free++; else outcome.ended++; }
    res.json({ signups: { week: rows.filter(x => now - x.created_at <= 7 * DAY).length, month: rows.filter(x => now - x.created_at <= 30 * DAY).length, total: rows.length },
      trials, endingSoon: trials.filter(t => t.daysLeft <= 7).length, quiet, outcome, trialDays: await trialDays(db) });
  });

  // One-click follow-up email to a trial's owner. The wording is fixed and shown to the Host before it goes; every send is logged.
  const nudgeText = (a, days, noDevices) => `Your free trial of myBoxStock has ${days} day${days === 1 ? '' : 's'} left.${noDevices ? ' You have not added any devices yet. Adding a few, or importing a spreadsheet, is the quickest way to see how it works.' : ''} If you are stuck or would like a hand getting set up, reply to this email or open Support inside the app.`;
  r.get('/trials/:id/nudge', async (req, res) => {
    const a = await db.get('SELECT id, business_name, owner_email, plan, trial_ends_at, plan_until, demo FROM accounts WHERE id = ?', [req.params.id]); if (!a) return res.status(404).json({ error: 'That account could not be found.' });
    const b = billingState(a), n = Number((await db.get("SELECT COUNT(*) AS n FROM records WHERE account_id = ? AND type = 'item'", [a.id])).n);
    if (b.state !== 'trial') return res.status(400).json({ error: 'That account is not on a running trial.' });
    res.json({ to: a.owner_email, text: nudgeText(a, b.daysLeft, n === 0), mailReady: !!(await mailReady(db)), demo: !!a.demo });
  });
  r.post('/trials/:id/nudge', async (req, res) => {
    const a = await db.get('SELECT id, account_code, business_name, owner_email, plan, trial_ends_at, plan_until, demo FROM accounts WHERE id = ?', [req.params.id]); if (!a) return res.status(404).json({ error: 'That account could not be found.' });
    const b = billingState(a); if (b.state !== 'trial') return res.status(400).json({ error: 'That account is not on a running trial.' });
    if (a.demo) return res.status(400).json({ error: 'This is a demo account, so no email is sent to it.' });
    if (!(await mailReady(db))) return res.status(400).json({ error: 'Email is not set up on this site yet. Set it up under Email first.' });
    const n = Number((await db.get("SELECT COUNT(*) AS n FROM records WHERE account_id = ? AND type = 'item'", [a.id])).n);
    await enqueueMail(db, a.owner_email, 'host_announcement', { name: a.business_name, notice: nudgeText(a, b.daysLeft, n === 0), url: await siteUrl(db).catch(() => '') }); processQueue(db).catch(() => {});
    hostLog(req, 'info', 'trial.nudge_sent', `Trial follow-up email queued for ${a.account_code} (${b.daysLeft} days left, ${n} device record${n === 1 ? '' : 's'})`, { area: 'accounts', accountId: a.id, data: { code: a.account_code, daysLeft: b.daysLeft, devices: n } });
    res.json({ ok: true });
  });

  // Paid accounts running out (or already lapsed) and trials ending, within the next 30 days.
  r.get('/renewals', async (req, res) => {
    const now = Date.now(), horizon = now + 30 * DAY;
    const rows = await db.all("SELECT id, account_code, business_name, owner_email, status, plan, trial_ends_at, plan_until, billing_cycle FROM accounts WHERE plan IN ('paid','trial')");
    const out = [];
    for (const x of rows) {
      const b = billingState(x, now), end = b.endsAt; if (!end) continue;
      if (x.plan === 'paid' && end <= horizon) out.push({ id: x.id, code: x.account_code, business: x.business_name, email: x.owner_email, kind: 'paid', endsAt: Number(end), lapsed: end < now, cycle: x.billing_cycle || '', status: subscriptionStatus(x, now) });
      if (x.plan === 'trial' && end <= horizon && end >= now - 14 * DAY) out.push({ id: x.id, code: x.account_code, business: x.business_name, email: x.owner_email, kind: 'trial', endsAt: Number(end), lapsed: end < now });
    }
    res.json({ renewals: out.sort((a, b) => a.endsAt - b.endsAt) });
  });

  // "Get set up": the few things a new site needs before real resellers sign up. Each is yes/no, with where to go to do it.
  r.get('/setup', async (req, res) => {
    const plans = await getSetting(db, 'plans', []), dests = await listDestinations(db).catch(() => []);
    const fw = Number((await db.get("SELECT COUNT(*) AS n FROM firewall_rules WHERE kind = 'host' AND enabled = 1")).n);
    const items = [
      { key: 'email', done: !!(await mailReady(db)), label: 'Email can be sent', hint: 'Sign-up confirmations, password resets and receipts all need it.', href: '#/email' },
      { key: 'backups', done: dests.some(x => !x.builtin), label: 'A backup destination is added', hint: 'A copy that lives somewhere other than this server.', href: '#/backups' },
      { key: 'firewall', done: fw > 0, label: 'The Host Console is limited to your addresses', hint: 'Add an access rule so only your own network can reach this console.', href: '#/firewall' },
      { key: 'plans', done: plans.length > 0, label: 'Plans and limits are written down', hint: 'Names, prices and what each plan includes.', href: '#/plans' },
    ];
    res.json({ items, allDone: items.every(x => x.done) });
  });

  // The plan list and the Limits list. Each plan has its own number for each limit (empty = no limit). Limits are enforced by the server when a reseller adds records or people (services/limits).
  // Plans saved before the Limits list existed carry their old "users" and "devices" numbers across to the first two limits.
  const planView = async () => {
    const limits = await getLimits(db), saved = await getSetting(db, 'planLimits', null);
    const plans = (await getSetting(db, 'plans', [])).map(p => ({ ...p, limits: p.limits || (saved ? {} : { 'lim-users': p.maxUsers ?? null, 'lim-devices': p.maxDevices ?? null }) }));
    return { plans, limits, defaultPlanId: await getSetting(db, 'defaultPlanId', ''), trialDays: await trialDays(db) };
  };
  r.get('/plans', async (req, res) => res.json(await planView()));
  r.put('/plans', async (req, res) => {
    const list = Array.isArray(req.body.plans) ? req.body.plans : null; if (!list || list.length > 20) return res.status(400).json({ error: 'Send a list of up to 20 plans.' });
    const lim = cleanLimits(req.body.limits ?? (await getLimits(db))); if (lim.error) return res.status(400).json({ error: lim.error });
    const out = [];
    for (const p of list) {
      const name = String(p.name || '').trim().slice(0, 60); if (!name) return res.status(400).json({ error: 'Every plan needs a name.' });
      const price = p.price === '' || p.price == null ? 0 : Math.round(Number(String(p.price).replace(/[^0-9.]/g, '')) * 100);
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: `Check the price for “${name}”.` });
      if (out.some(x => x.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: `There are two plans called “${name}”.` });
      const limits = {};
      for (const d of lim.limits) { const n = limitNum(p.limits?.[d.id]); if (Number.isNaN(n)) return res.status(400).json({ error: `Check the “${d.name}” number for “${name}”.` }); if (n != null) limits[d.id] = n; }
      out.push({ id: String(p.id || newId()).slice(0, 40), name, priceCents: price, interval: p.interval === 'year' ? 'year' : 'month', limits, note: String(p.note || '').slice(0, 200) });
    }
    // A plan that accounts are on cannot disappear underneath them.
    const before = await getSetting(db, 'plans', []);
    for (const gone of before.filter(b => !out.some(o => o.id === b.id))) {
      const n = Number((await db.get('SELECT COUNT(*) AS n FROM accounts WHERE plan_ref = ?', [gone.id])).n);
      if (n) return res.status(400).json({ error: `“${gone.name}” is used by ${n} account${n === 1 ? '' : 's'}. Move ${n === 1 ? 'it' : 'them'} to another plan first (open the account, then Plan and limits).` });
    }
    const defaultPlanId = out.some(x => x.id === req.body.defaultPlanId) ? req.body.defaultPlanId : '';
    await setSetting(db, 'planLimits', lim.limits); await setSetting(db, 'plans', out); await setSetting(db, 'defaultPlanId', defaultPlanId);
    hostLog(req, 'info', 'plans.saved', `Plan list saved (${out.length} plan${out.length === 1 ? '' : 's'}, ${lim.limits.length} limit${lim.limits.length === 1 ? '' : 's'})`, { data: { plans: out.map(x => x.name), limits: lim.limits.map(x => x.name) } });
    res.json(await planView());
  });
  return r;
}
