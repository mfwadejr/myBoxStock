// SERVICES / demo / plan — works out, from a set's recipe and its seed alone, what each demo account will look like: its name, sign-in code, people, plan and how many
// devices, customers and sales it holds. Pure and deterministic (no database, no clock except the anchor you pass), so the estimate shown before a Build and the Build itself agree,
// and the same seed always gives the same accounts.
import { rng, seedOf } from './rng.mjs';

export const DAY = 86400e3;
const ADJ = ['Amber', 'Azure', 'Bright', 'Cedar', 'Cobalt', 'Delta', 'Ember', 'Falcon', 'Granite', 'Harbor', 'Indigo', 'Juniper', 'Keystone', 'Lumen', 'Maple', 'Nova', 'Onyx', 'Pioneer', 'Quartz', 'Ridge', 'Summit', 'Timber', 'Union', 'Vista', 'Willow', 'Zenith'];
const NOUN = ['Streams', 'Media', 'Boxes', 'Tech', 'Supply', 'Resale', 'Depot', 'Direct', 'Traders', 'Hub', 'Outlet', 'Source'];
export const codeOf = (set, i) => `${set.key}-${String(i + 1).padStart(Math.max(3, String(set.accounts).length), '0')}`;
export const domain = 'demo.myboxstock.invalid';        // reserved, never delivers; the mail guard also blocks it

// Which accounts (never the first, which holds the named logins) are the "very large" ones.
export function bigIndexes(set) {
  const r = rng(seedOf(set.seed, set.key, 'big')), pool = Array.from({ length: Math.max(0, set.accounts - 1) }, (_, k) => k + 1), out = new Set();
  while (out.size < Math.min(set.devices.big, pool.length)) out.add(pool[r.int(0, pool.length - 1)]);
  return out;
}
const sizeFor = (set, i, r, big, ceiling) => {
  const { min, max } = set.devices, top = ceiling ? Math.min(max, ceiling) : max, lo = Math.min(min, top);
  let n;
  if (i === 0) n = Math.round(Math.sqrt(lo * top));                                     // the named account is a medium one
  else if (big.has(i)) n = Math.round(top * (0.7 + r.next() * 0.3));                     // always a few very large accounts
  else n = Math.round(lo * Math.pow(top / lo, Math.pow(r.next(), 2.4)));                 // mostly tens, some hundreds, few thousands
  return Math.max(lo, Math.min(top, n));
};

// The shape of account number i (0-based) in the set. `anchor` is the moment "now" for dates (epoch ms).
export function planAccount(set, i, anchor, { ceiling = 0, big = null } = {}) {
  const r = rng(seedOf(set.seed, set.key, 'acct', i)), bg = big || bigIndexes(set), code = codeOf(set, i);
  const primary = i === 0, name = primary ? set.name : `${r.pick(ADJ)} ${r.pick(NOUN)} ${String(i + 1).padStart(3, '0')}`;
  const ownerName = primary ? set.key : 'owner';
  const teamN = Math.max(primary ? 2 : 0, r.int(set.team.min, set.team.max));
  const team = [];
  if (primary) team.push({ username: `${set.key}-std`, role: 'Standard', kind: 'std' }, { username: `${set.key}-view`, role: 'View', kind: 'view' });
  while (team.length < teamN) team.push({ username: `member${team.length + 1}`, role: r.weighted(set.roles), kind: 'filler' });
  const devices = sizeFor(set, i, r, bg, ceiling), plan = r.weighted(set.status);
  const age = Math.round((0.2 + r.next() * 0.8) * set.historyMonths * 30);              // days since the account was created
  const created = anchor - age * DAY;
  return {
    index: i, code, name, primary, devices, plan, createdAt: created,
    trialEnds: plan === 'trial' ? anchor + r.int(20, 300) * DAY : null,                  // kept in the future so demo trials stay usable
    planUntil: plan === 'paid' ? anchor + r.int(60, 400) * DAY : null,
    owner: { username: ownerName, role: 'Administrator', kind: primary ? 'owner' : 'filler' }, team,
    users: [{ username: ownerName, role: 'Administrator', kind: primary ? 'owner' : 'filler' }, ...team],
  };
}

// What a Build would make, without making it: counts (exact for accounts, people and devices; expected for customers and sales) and a size and time estimate.
export const BYTES_PER_RECORD = 820, RECORDS_PER_SECOND = 6000;   // measured on a laptop-class server (Demo300: 77,000 records, 63 MB, 12 s); shown as "about"
export function estimate(set, { ceiling = 0, anchor = Date.now() } = {}) {
  const big = bigIndexes(set), sh = set.shares, sum = Object.values(sh).reduce((a, b) => a + b, 0) || 1, sold = (sh.sold || 0) / sum, perSale = (1 + set.maxPerSale) / 2;
  let users = 0, devices = 0, largest = 0, records = 0;
  for (let i = 0; i < set.accounts; i++) {
    const p = planAccount(set, i, anchor, { ceiling, big }), soldN = p.devices * sold, cust = soldN * set.customersPer100Sold / 100;
    users += p.users.length; devices += p.devices; largest = Math.max(largest, p.devices);
    records += p.devices + Math.ceil(soldN / perSale) + Math.ceil(cust) + 4;            // devices, sales, customers, a few models
  }
  records = Math.round(records);
  return { accounts: set.accounts, users, devices, largest, records, bytes: records * BYTES_PER_RECORD + set.accounts * 4096 + users * 1024, seconds: Math.max(2, Math.round(records / RECORDS_PER_SECOND + users * 0.01)) };
}
