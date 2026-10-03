// SERVICES / billing / state — pure functions that turn an account's plan columns into a billing state.
// states: trial | trial_expired | free | paid | paid_expired.   canWrite is false only when a trial or paid period has ended.
export const DAY = 86400e3;
export const PLANS = ['trial', 'free', 'paid'];

export function billingState(a, now = Date.now()) {
  const plan = a.plan || 'free';
  const ends = plan === 'trial' ? a.trial_ends_at : plan === 'paid' ? a.plan_until : null;
  const endsAt = ends == null ? null : Number(ends);
  const expired = endsAt != null && endsAt < now;
  const state = plan === 'trial' ? (expired ? 'trial_expired' : 'trial') : plan === 'paid' ? (expired ? 'paid_expired' : 'paid') : 'free';
  return { plan, state, endsAt, daysLeft: endsAt == null ? null : Math.max(0, Math.ceil((endsAt - now) / DAY)), canWrite: !expired };
}
export const stateLabel = (b) => ({ trial: 'Trial', trial_expired: 'Trial ended', free: 'Free', paid: 'Paid', paid_expired: 'Paid period ended' }[b.state]);
