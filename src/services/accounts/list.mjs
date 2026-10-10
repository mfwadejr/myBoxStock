// SERVICES / accounts / list — the Host's Accounts list: search, the plan and health filters, the "Needs attention" view and the sort order.
// Used by the Accounts page and by the bulk actions, so "all accounts matching this filter" always means the same accounts in both.
// PRIVACY BOUNDARY: identity, plan and security columns only. Never inventory, sales or customer data.
import { billingState, DAY } from '../billing/state.mjs';
import { getSupportSettings, overdueTickets } from '../support/index.mjs';

export const SORTS = ['business', 'days', 'users', 'last_login'];
export const ATTENTION_DAYS_DEFAULT = 7, ATTENTION_DAYS_MAX = 365;
export const LIST_LIMIT = 500;

const HEALTH_SQL = `(SELECT COUNT(*) FROM account_users u WHERE u.account_id = a.id) AS user_count,
  (SELECT MAX(u.last_login) FROM account_users u WHERE u.account_id = a.id) AS last_login,
  (SELECT COUNT(*) FROM account_users u WHERE u.account_id = a.id AND u.role = 'Administrator' AND u.totp_enabled = 1) AS admins_2fa,
  (SELECT COUNT(*) FROM account_users u WHERE u.account_id = a.id AND u.email IS NOT NULL AND u.email_verified_at IS NULL) AS unverified,
  (SELECT COUNT(*) FROM account_recovery rc WHERE rc.account_id = a.id) AS encrypted,
  (SELECT COUNT(*) FROM account_recovery rc WHERE rc.account_id = a.id AND rc.confirmed_at IS NOT NULL) AS recovery_saved`;

const inactive30 = (x, now) => (x.last_login ? now - Number(x.last_login) > 30 * DAY : now - Number(x.created_at) > 30 * DAY);
export const FILTERS = {
  no_recovery: (x) => x.encrypted && !x.recovery_saved, not_encrypted: (x) => !x.encrypted, no_2fa: (x) => !x.admins_2fa, unverified: (x) => x.unverified > 0,
  inactive30: (x, c) => inactive30(x, c.now), closing: (x) => !!x.closing_at, suspended: (x) => x.status === 'suspended', read_only: (x) => !x.billing.canWrite,
  // Everything worth a follow-up in one view: no recovery key, email not verified, inactive 30 days, a trial ending soon, a support ticket past its response target.
  attention: (x, c) => attentionReasons(x, c).length > 0,
};
// Why an account needs attention, in words (empty list = nothing to do).
export function attentionReasons(x, c) {
  const out = [];
  if (FILTERS.no_recovery(x)) out.push('No recovery key');
  if (FILTERS.unverified(x)) out.push('Email not verified');
  if (inactive30(x, c.now)) out.push('Inactive 30 days');
  if (x.billing.state === 'trial' && x.billing.endsAt != null && x.billing.endsAt - c.now <= c.attentionDays * DAY) out.push('Trial ending soon');
  if (c.overdue?.has(x.id)) out.push('Ticket overdue');
  return out;
}

export const cleanDays = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= ATTENTION_DAYS_MAX ? n : ATTENTION_DAYS_DEFAULT; };

// Which accounts have a support ticket waiting on the Host past the response target (a set of account ids).
export async function overdueAccountIds(db, now = Date.now()) {
  const late = await overdueTickets(db, await getSupportSettings(db), now), ids = new Set();
  for (const t of late) { const r = await db.get('SELECT account_id FROM support_tickets WHERE id = ?', [t.id]); if (r?.account_id) ids.add(r.account_id); }
  return ids;
}

const num = (x) => ({ ...x, demo: !!Number(x.demo), user_count: Number(x.user_count), admins_2fa: Number(x.admins_2fa), unverified: Number(x.unverified), encrypted: Number(x.encrypted), recovery_saved: Number(x.recovery_saved), last_login: x.last_login ? Number(x.last_login) : null });
// Sort keys: a missing value (no end date, never signed in) always sorts last, whichever way the list runs.
const KEY = { business: (x) => x.business_name.toLowerCase(), days: (x) => (x.billing.endsAt == null ? null : x.billing.daysLeft), users: (x) => x.user_count, last_login: (x) => x.last_login };
export function sortRows(rows, sort, dir) {
  if (!SORTS.includes(sort)) return rows;
  const k = KEY[sort], sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => { const x = k(a), y = k(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * sign; });
}

// q, plan, health, attentionDays, sort, dir. Returns up to LIST_LIMIT rows (newest accounts first unless sorted).
export async function listAccounts(db, query = {}, { limit = LIST_LIMIT, now = Date.now() } = {}) {
  const q = `%${String(query.q || '').toLowerCase()}%`, want = String(query.plan || ''), health = String(query.health || '');
  const rows = await db.all(`SELECT a.id, a.account_code, a.business_name, a.owner_email, a.status, a.plan, a.trial_ends_at, a.plan_until, a.plan_note, a.created_at, a.last_activity, a.closing_at, a.demo,
    ${HEALTH_SQL} FROM accounts a
    WHERE (LOWER(a.business_name) LIKE ? OR LOWER(a.account_code) LIKE ? OR LOWER(a.owner_email) LIKE ?)${query.demo === 'hide' ? ' AND a.demo = 0' : ''} ORDER BY a.created_at DESC LIMIT ${Number(limit)}`, [q, q, q]);
  const ctx = { now, attentionDays: cleanDays(query.attentionDays), overdue: health === 'attention' ? await overdueAccountIds(db, now) : null };
  const out = rows.map(x => { const n = num(x); return { ...n, billing: billingState(n, now) }; })
    .filter(x => !want || (want === 'expired' ? !x.billing.canWrite : x.billing.state === want))
    .filter(x => !health || !FILTERS[health] || FILTERS[health](x, ctx));
  if (health === 'attention') for (const x of out) x.attention = attentionReasons(x, ctx);
  return sortRows(out, String(query.sort || ''), String(query.dir || 'asc'));
}

// The same rows as the list, for chosen account ids.
export async function accountsByIds(db, ids, now = Date.now()) {
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const rows = await db.all(`SELECT a.id, a.account_code, a.business_name, a.owner_email, a.status, a.plan, a.trial_ends_at, a.plan_until, a.plan_note, a.created_at, a.last_activity, a.closing_at, a.demo,
      ${HEALTH_SQL} FROM accounts a WHERE a.id IN (${part.map(() => '?').join(',')})`, part);
    for (const x of rows) { const n = num(x); out.push({ ...n, billing: billingState(n, now) }); }
  }
  return out;
}
