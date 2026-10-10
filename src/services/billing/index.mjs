// SERVICES / billing — trial length setting, plan changes (with history), and the expiry sweep.
// Billing data is HOST data about an account (plan, dates, notes). It never contains inventory, sales or customer data.
import { newId } from '../../core/ids.mjs';
import { getSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { enqueueMail, processQueue } from '../mail/index.mjs';
import { billingState, DAY } from './state.mjs';

const L = areaLogger('accounts');
export const DEFAULT_TRIAL_DAYS = 14;

export async function trialDays(db) {
  const n = Number(await getSetting(db, 'trial_days', DEFAULT_TRIAL_DAYS));
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : DEFAULT_TRIAL_DAYS;
}

export async function recordEvent(t, { accountId, kind, from = null, to = null, actor = 'system', note = null, detail = null }) {
  await t.run('INSERT INTO billing_events (id, account_id, ts, kind, from_plan, to_plan, actor, note, detail) VALUES (?,?,?,?,?,?,?,?,?)',
    [newId(), accountId, Date.now(), kind, from, to, actor, note ? String(note).slice(0, 255) : null, detail ? JSON.stringify(detail) : null]);
}

// Applies a plan change chosen by a host administrator. Returns the new billing state.
//   plan 'free'  — comped account, never expires
//   plan 'trial' — { days, extend }  days from today, or added to the current end date when extend is true and the trial is still running
//   plan 'paid'  — { until }  'YYYY-MM-DD' (end of that day, UTC) or empty for no end date
export async function setPlan(db, account, { plan, days, extend, until, note, actor }) {
  const now = Date.now(), cur = billingState(account, now);
  let trialEnds = null, planUntil = null;
  if (plan === 'trial') {
    const n = Number(days); if (!Number.isInteger(n) || n < 1 || n > 730) throw Object.assign(new Error('Trial length must be 1–730 days.'), { status: 400 });
    const base = extend && cur.state === 'trial' && cur.endsAt ? cur.endsAt : now;
    trialEnds = base + n * DAY;
  } else if (plan === 'paid' && until) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(Date.parse(until))) throw Object.assign(new Error('Enter the paid-through date as YYYY-MM-DD.'), { status: 400 });
    planUntil = Date.parse(until + 'T23:59:59Z');
  } else if (plan !== 'free' && plan !== 'paid') throw Object.assign(new Error('Unknown plan.'), { status: 400 });
  const cleanNote = note ? String(note).trim().slice(0, 255) : null;
  await db.tx(async (t) => {
    await t.run('UPDATE accounts SET plan = ?, trial_ends_at = ?, plan_until = ?, plan_note = ?, plan_changed_at = ?, expiry_noted = 0 WHERE id = ?', [plan, trialEnds, planUntil, cleanNote, now, account.id]);
    await recordEvent(t, { accountId: account.id, kind: plan === 'trial' && extend ? 'trial_extended' : 'plan_changed', from: cur.plan, to: plan, actor, note: cleanNote, detail: { trialEnds, planUntil } });
  });
  L.info('plan.changed', `Account ${account.account_code} plan ${cur.plan} → ${plan}${trialEnds ? ` (trial ends ${new Date(trialEnds).toISOString().slice(0, 10)})` : ''}${planUntil ? ` (paid through ${until})` : ''}${cleanNote ? ` — ${cleanNote}` : ''}`,
    { actor, accountId: account.id, data: { code: account.account_code, from: cur.plan, to: plan, trialEnds, planUntil } });
  return billingState({ plan, trial_ends_at: trialEnds, plan_until: planUntil });
}

// Hourly: note trials / paid periods that have ended (once each), log them, and email the owner.
export async function sweepExpired(db) {
  const now = Date.now();
  const rows = await db.all(`SELECT id, account_code, owner_email, business_name, plan, trial_ends_at, plan_until FROM accounts
    WHERE demo = 0 AND expiry_noted = 0 AND ((plan = 'trial' AND trial_ends_at < ?) OR (plan = 'paid' AND plan_until IS NOT NULL AND plan_until < ?))`, [now, now]);
  for (const a of rows) {
    await db.tx(async (t) => {
      await t.run('UPDATE accounts SET expiry_noted = 1 WHERE id = ?', [a.id]);
      await recordEvent(t, { accountId: a.id, kind: a.plan === 'trial' ? 'trial_expired' : 'paid_expired', from: a.plan, to: a.plan });
    });
    L.warn(a.plan === 'trial' ? 'trial.expired' : 'paid.expired', `Account ${a.account_code} ${a.plan === 'trial' ? 'trial' : 'paid period'} ended — account is now read-only`, { accountId: a.id, data: { code: a.account_code } });
    if (a.owner_email) await enqueueMail(db, a.owner_email, 'trial_ended', { name: a.business_name, accountCode: a.account_code });
  }
  if (rows.length) processQueue(db).catch(() => {});
  return rows.length;
}
