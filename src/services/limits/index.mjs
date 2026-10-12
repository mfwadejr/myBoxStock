// SERVICES / limits — plan limits: what can be counted, how an account's numbers are worked out, and the check used when something is added.
// The server can only count what it can see: team members from the user list, and records by their plain-text type and created time.
// It never looks inside a record, so "devices in stock" or "loans" cannot be counted. Counting devices counts every device record, sold or not.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { newId } from '../../core/ids.mjs';

export const COUNTS = { admins: 'Administrators', users: 'Team members (including administrators)', item: 'Device records', sale: 'Sales records', customer: 'Customer records', model: 'Models' };
export const PERIODS = { all: 'All time', d365: 'Rolling 12 months', d30: 'Rolling 30 days' };
export const ACTIONS = { warn: 'Warn only', block: 'Block adding new' };
const DAYS = { d365: 365, d30: 30 };

// The list a new site starts with. The two older fields (users and devices included) become the first two limits so nothing already written down is lost.
export const seedLimits = () => [
  { id: 'lim-users', name: 'Team members', counts: 'users', period: 'all', warnPct: 80, action: 'warn' },
  { id: 'lim-devices', name: 'Devices', counts: 'item', period: 'all', warnPct: 80, action: 'warn' },
  { id: 'lim-sales', name: 'Sales', counts: 'sale', period: 'all', warnPct: 80, action: 'warn' },
];

export async function getLimits(db) { return await getSetting(db, 'planLimits', null) || seedLimits(); }

// Read the Limits list from a request body. Returns { limits } or { error }.
export function cleanLimits(list) {
  if (!Array.isArray(list) || list.length > 30) return { error: 'Send a list of up to 30 limits.' };
  const out = [];
  for (const x of list) {
    const name = String(x?.name || '').trim().slice(0, 60); if (!name) return { error: 'Every limit needs a name.' };
    if (!COUNTS[x.counts]) return { error: `Choose what “${name}” counts.` };
    if (!PERIODS[x.period]) return { error: `Choose a counting period for “${name}”.` };
    if (!ACTIONS[x.action]) return { error: `Choose what happens at the cap for “${name}”.` };
    const warnPct = Math.round(Number(x.warnPct)); if (!Number.isFinite(warnPct) || warnPct < 1 || warnPct > 100) return { error: `Warn-at for “${name}” must be 1 to 100 percent.` };
    if (out.some(y => y.name.toLowerCase() === name.toLowerCase())) return { error: `There are two limits called “${name}”.` };
    out.push({ id: String(x.id || newId()).slice(0, 40), name, counts: x.counts, period: x.period, warnPct, action: x.action });
  }
  return { limits: out };
}

// A number, or null for "no limit". NaN when it is not a usable number.
export const limitNum = (v) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 1e9 ? n : NaN; };

// The numbers that apply to one account: the Host's override first, then the plan's own number. No plan and no override = no limit.
export async function effectiveLimits(db, acct) {
  const defs = await getLimits(db), plans = await getSetting(db, 'plans', []);
  const row = acct.plan_ref !== undefined && acct.limit_overrides !== undefined ? acct : await db.get('SELECT plan_ref, limit_overrides FROM accounts WHERE id = ?', [acct.id]);
  const plan = plans.find(p => p.id === row?.plan_ref);
  let over = {}; try { over = JSON.parse(row?.limit_overrides || '{}') || {}; } catch { /* a damaged value counts as no overrides */ }
  return defs.map(d => {
    const own = plan?.limits?.[d.id] ?? null, has = Object.prototype.hasOwnProperty.call(over, d.id);
    return { ...d, limit: has ? over[d.id] : own, source: has ? 'override' : (own != null ? 'plan' : 'none'), planName: plan?.name || '' };
  });
}

export async function countFor(db, accountId, def, now = Date.now()) {
  if (def.counts === 'users') return Number((await db.get('SELECT COUNT(*) AS n FROM account_users WHERE account_id = ?', [accountId])).n);
  if (def.counts === 'admins') return Number((await db.get("SELECT COUNT(*) AS n FROM account_users WHERE account_id = ? AND role = 'Administrator'", [accountId])).n);
  if (def.period === 'all') return Number((await db.get('SELECT COUNT(*) AS n FROM records WHERE account_id = ? AND type = ?', [accountId, def.counts])).n);
  return Number((await db.get('SELECT COUNT(*) AS n FROM records WHERE account_id = ? AND type = ? AND created_at >= ?', [accountId, def.counts, now - DAYS[def.period] * 86400e3])).n);
}

// Each limit with how much is used. state: none (no number) | ok | warn (at or past the warn-at percent) | full (at or past the cap).
export async function usageFor(db, acct, now = Date.now()) {
  const list = await effectiveLimits(db, acct), out = [];
  for (const d of list) {
    const used = await countFor(db, acct.id, d, now), pct = d.limit ? Math.round(used / d.limit * 100) : 0;
    const state = d.limit == null ? 'none' : used >= d.limit ? 'full' : pct >= d.warnPct ? 'warn' : 'ok';
    out.push({ id: d.id, name: d.name, counts: d.counts, period: d.period, action: d.action, warnPct: d.warnPct, limit: d.limit, used, pct, state, source: d.source });
  }
  return out;
}

// Would adding these take a blocking limit past its cap? adds = { item: 3, sale: 1, users: 1, admins: 0 }. Returns the first limit that would be broken, or null.
export async function wouldBreak(db, acct, adds, now = Date.now()) {
  for (const d of await usageFor(db, acct, now)) {
    if (d.action !== 'block' || d.limit == null) continue;
    const more = Number(adds[d.counts] || 0); if (!more) continue;
    if (d.used + more > d.limit) return { ...d, adding: more };
  }
  return null;
}
export const breakText = (b) => `Your plan allows ${b.limit} ${b.name.toLowerCase()}${b.period === 'all' ? '' : ' (' + PERIODS[b.period].toLowerCase() + ')'} and you have ${b.used}. Adding ${b.adding} more would go over. Nothing was saved. Ask your provider about a larger plan.`;
export { setSetting };
