// ROUTES / host / business — run the business: signup and trial pipeline, renewals, and the plan list.
// Only Host-side facts (plan, dates, contact address). Never business data of an account.
import express from 'express';
import { hostLog } from './context.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { billingState, DAY } from '../../services/billing/state.mjs';
import { trialDays } from '../../services/billing/index.mjs';
import { newId } from '../../core/ids.mjs';

const num = (v, min, max) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : NaN; };

export function businessRoutes(db) {
  const r = express.Router();

  r.get('/pipeline', async (req, res) => {
    const now = Date.now(), rows = (await db.all(`SELECT a.id, a.account_code, a.business_name, a.owner_email, a.status, a.plan, a.trial_ends_at, a.plan_until, a.created_at, a.last_activity,
      (SELECT MAX(u.last_login) FROM account_users u WHERE u.account_id = a.id) AS last_login FROM accounts a ORDER BY a.created_at DESC`)).map(x => ({ ...x, created_at: Number(x.created_at), last_activity: x.last_activity ? Number(x.last_activity) : null, last_login: x.last_login ? Number(x.last_login) : null, billing: billingState(x, now) }));
    const seen = (x) => Math.max(x.last_login || 0, x.last_activity || 0, x.created_at);
    const trials = rows.filter(x => x.billing.state === 'trial').map(x => ({ id: x.id, code: x.account_code, business: x.business_name, email: x.owner_email, daysLeft: x.billing.daysLeft, endsAt: x.billing.endsAt, lastSeen: seen(x) })).sort((a, b) => a.daysLeft - b.daysLeft);
    const quiet = rows.filter(x => x.status === 'active' && x.billing.canWrite && now - seen(x) > 7 * DAY).map(x => ({ id: x.id, code: x.account_code, business: x.business_name, plan: x.billing.state, lastSeen: seen(x) })).sort((a, b) => a.lastSeen - b.lastSeen).slice(0, 50);
    // Where did the accounts that started on a trial end up? (current state of each)
    const outcome = { trial: 0, paid: 0, free: 0, ended: 0 };
    for (const x of rows) { const s = x.billing.state; if (s === 'trial') outcome.trial++; else if (s === 'paid') outcome.paid++; else if (s === 'free') outcome.free++; else outcome.ended++; }
    res.json({ signups: { week: rows.filter(x => now - x.created_at <= 7 * DAY).length, month: rows.filter(x => now - x.created_at <= 30 * DAY).length, total: rows.length },
      trials, endingSoon: trials.filter(t => t.daysLeft <= 7).length, quiet, outcome, trialDays: await trialDays(db) });
  });

  // Paid accounts running out (or already lapsed) and trials ending, within the next 30 days.
  r.get('/renewals', async (req, res) => {
    const now = Date.now(), horizon = now + 30 * DAY;
    const rows = await db.all("SELECT id, account_code, business_name, owner_email, status, plan, trial_ends_at, plan_until FROM accounts WHERE plan IN ('paid','trial')");
    const out = [];
    for (const x of rows) {
      const b = billingState(x, now), end = b.endsAt; if (!end) continue;
      if (x.plan === 'paid' && end <= horizon) out.push({ id: x.id, code: x.account_code, business: x.business_name, email: x.owner_email, kind: 'paid', endsAt: Number(end), lapsed: end < now });
      if (x.plan === 'trial' && end <= horizon && end >= now - 14 * DAY) out.push({ id: x.id, code: x.account_code, business: x.business_name, email: x.owner_email, kind: 'trial', endsAt: Number(end), lapsed: end < now });
    }
    res.json({ renewals: out.sort((a, b) => a.endsAt - b.endsAt) });
  });

  // The plan list: names, prices and limits written down ahead of taking payments. Limits are recorded here and are not enforced yet.
  r.get('/plans', async (req, res) => res.json({ plans: await getSetting(db, 'plans', []), trialDays: await trialDays(db) }));
  r.put('/plans', async (req, res) => {
    const list = Array.isArray(req.body.plans) ? req.body.plans : null; if (!list || list.length > 20) return res.status(400).json({ error: 'Send a list of up to 20 plans.' });
    const out = [];
    for (const p of list) {
      const name = String(p.name || '').trim().slice(0, 60); if (!name) return res.status(400).json({ error: 'Every plan needs a name.' });
      const price = p.price === '' || p.price == null ? 0 : Math.round(Number(String(p.price).replace(/[^0-9.]/g, '')) * 100);
      const users = num(p.maxUsers, 1, 100000), devices = num(p.maxDevices, 1, 10000000);
      if (!Number.isFinite(price) || price < 0 || Number.isNaN(users) || Number.isNaN(devices)) return res.status(400).json({ error: `Check the numbers for “${name}”.` });
      if (out.some(x => x.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: `There are two plans called “${name}”.` });
      out.push({ id: String(p.id || newId()).slice(0, 40), name, priceCents: price, interval: p.interval === 'year' ? 'year' : 'month', maxUsers: users, maxDevices: devices, note: String(p.note || '').slice(0, 200) });
    }
    await setSetting(db, 'plans', out);
    hostLog(req, 'info', 'plans.saved', `Plan list saved (${out.length} plan${out.length === 1 ? '' : 's'})`, { data: { plans: out.map(x => x.name) } });
    res.json({ plans: out });
  });
  return r;
}
