// SERVICES / billing / subscription — the Host's own tracking of a paid account: how often it is billed, whether it is current, and the next paid-through date.
// Nothing here charges anyone. Money is recorded by hand as a receipt; provider ids stay empty until a payment system is connected.
import { DAY } from './state.mjs';

export const DUE_SOON_DAYS = 7;
export const CYCLES = ['month', 'year'];

// current | due (paid period ends within 7 days) | overdue (it has ended) | none (trial, free, or no paid period)
export function subscriptionStatus(a, now = Date.now()) {
  if (a.plan !== 'paid' || a.plan_until == null) return 'none';
  const end = Number(a.plan_until);
  return end < now ? 'overdue' : end - now <= DUE_SOON_DAYS * DAY ? 'due' : 'current';
}
export const STATUS_LABEL = { current: 'Current', due: 'Due soon', overdue: 'Overdue', none: '' };

// The date one billing period after the later of today and the current paid-through date (as YYYY-MM-DD, UTC). Used to pre-fill "paid through".
export function nextPaidThrough(a, now = Date.now()) {
  const from = new Date(Math.max(now, Number(a.plan_until) || 0)), cycle = a.billing_cycle === 'year' ? 'year' : 'month';
  const d = new Date(Date.UTC(from.getUTCFullYear() + (cycle === 'year' ? 1 : 0), from.getUTCMonth() + (cycle === 'month' ? 1 : 0), from.getUTCDate()));
  return d.toISOString().slice(0, 10);
}
