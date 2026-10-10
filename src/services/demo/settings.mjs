// SERVICES / demo / settings — the Demo mode section's settings: the on/off switch, the safety limits, and one editable recipe per size set (Demo3, Demo300, Demo1000, Demo5000
// and any Custom sets). Every number can be changed; every set and the whole section can be reset to the built-in defaults. Saved in the settings table under "demo_mode".
// Nothing here touches an account: it only reads and writes this one settings entry.
import { getSetting, setSetting } from '../../db/settings.mjs';
import { coded } from './audit.mjs';

const KEY = 'demo_mode';
export const LIMITS_MAX = { accounts: 5000, devicesPerAccount: 20000, records: 8000000 };
export const ROLE_NAMES = ['Administrator', 'Standard', 'View'];
export const SHARE_NAMES = ['sold', 'available', 'reserved', 'returned', 'damaged', 'archived'];
export const PLAN_NAMES = ['trial', 'free', 'paid'];

const common = (seed) => ({
  team: { min: 1, max: 3 },                                  // team members besides the Owner
  roles: { Administrator: 20, Standard: 50, View: 30 },      // mix of roles for team members (relative weights)
  shares: { sold: 55, available: 33, reserved: 2, returned: 4, damaged: 2, archived: 4 }, // share of devices in each state (relative weights)
  customersPer100Sold: 55, maxPerSale: 3,
  status: { trial: 40, free: 20, paid: 40 },                 // account status mix (relative weights)
  historyMonths: 12, seed,
});
const SET = (key, name, accounts, devices) => ({ key, name, custom: false, accounts, devices, ...common(key === 'demo3' ? 3 : key === 'demo300' ? 300 : key === 'demo1000' ? 1000 : 5000) });
export const defaultSets = () => [
  SET('demo3', 'Demo3', 3, { min: 20, max: 500, big: 1 }),
  SET('demo300', 'Demo300', 300, { min: 10, max: 2000, big: 3 }),
  SET('demo1000', 'Demo1000', 1000, { min: 10, max: 2000, big: 5 }),
  SET('demo5000', 'Demo5000', 5000, { min: 10, max: 3000, big: 10 }),
];
export const defaultSection = () => ({
  enabled: false, backupMaxAgeHours: 24, excludeFromBackups: true, usePlanCeiling: false,
  limits: { accounts: 5000, devicesPerAccount: 5000, records: 6000000 },
  sets: defaultSets(), everBuilt: false, lastBackupCheck: null,
});

const num = (v, lo, hi, what) => { const n = Number(v); if (!Number.isFinite(n) || !Number.isInteger(n) || n < lo || n > hi) throw coded('DEMO_SETTINGS_BAD', { error: `${what} must be a whole number from ${lo.toLocaleString('en-US')} to ${hi.toLocaleString('en-US')}.` }); return n; };
const weights = (o, names, what) => {
  const out = {}; let sum = 0;
  for (const k of names) { out[k] = num(o?.[k] ?? 0, 0, 1000, `${what}: ${k}`); sum += out[k]; }
  if (!sum) throw coded('DEMO_SETTINGS_BAD', { error: `${what} needs at least one number above zero.` });
  return out;
};
// One set, checked and cleaned. `limits` are the section's safety limits (a set may not ask for more than they allow).
export function cleanSet(s, limits, base = null) {
  if (!s || typeof s !== 'object') throw coded('DEMO_SETTINGS_BAD');
  const key = String(base?.key ?? s.key ?? ''), name = String(s.name ?? base?.name ?? '').trim();
  if (!/^[a-z][a-z0-9]{1,19}$/.test(key)) throw coded('DEMO_CUSTOM_BAD');
  if (!/^[A-Za-z][A-Za-z0-9]{2,19}$/.test(name)) throw coded('DEMO_CUSTOM_BAD');
  if (key !== name.toLowerCase()) throw coded('DEMO_CUSTOM_BAD', { error: 'The name and the sign-in key must match: use the same letters and numbers.' });
  const accounts = num(s.accounts, 1, limits.accounts, 'Accounts');
  const d = s.devices || {}, dmin = num(d.min, 1, limits.devicesPerAccount, 'Fewest devices'), dmax = num(d.max, 1, limits.devicesPerAccount, 'Most devices');
  if (dmin > dmax) throw coded('DEMO_SETTINGS_BAD', { error: 'Fewest devices cannot be more than most devices.' });
  const big = num(d.big ?? 0, 0, accounts, 'Very large accounts');
  const t = s.team || {}, tmin = num(t.min, 0, 20, 'Fewest team members'), tmax = num(t.max, 0, 20, 'Most team members');
  if (tmin > tmax) throw coded('DEMO_SETTINGS_BAD', { error: 'Fewest team members cannot be more than most team members.' });
  return {
    key, name, custom: !!(base ? base.custom : s.custom), accounts, devices: { min: dmin, max: dmax, big }, team: { min: tmin, max: tmax },
    roles: weights(s.roles, ROLE_NAMES, 'Team roles'), shares: weights(s.shares, SHARE_NAMES, 'Device states'), status: weights(s.status, PLAN_NAMES, 'Account status'),
    customersPer100Sold: num(s.customersPer100Sold, 0, 500, 'Customers per 100 sold devices'), maxPerSale: num(s.maxPerSale, 1, 10, 'Most devices in one sale'),
    historyMonths: num(s.historyMonths, 1, 60, 'Months of sales history'), seed: num(s.seed, 0, 2147483647, 'Random seed'),
  };
}
const cleanLimits = (l, cur) => ({
  accounts: num(l?.accounts ?? cur.accounts, 1, LIMITS_MAX.accounts, 'Most accounts'), devicesPerAccount: num(l?.devicesPerAccount ?? cur.devicesPerAccount, 1, LIMITS_MAX.devicesPerAccount, 'Most devices in one account'),
  records: num(l?.records ?? cur.records, 1000, LIMITS_MAX.records, 'Most records in one build'),
});

// The section as saved, with anything missing filled from the defaults (a set that was never edited is simply the default).
export async function getDemo(db) {
  const saved = (await getSetting(db, KEY, null)) || {}, def = defaultSection();
  const sets = def.sets.map(d => { const s = (saved.sets || []).find(x => x.key === d.key); return s ? { ...d, ...s, devices: { ...d.devices, ...s.devices }, team: { ...d.team, ...s.team }, roles: { ...d.roles, ...s.roles }, shares: { ...d.shares, ...s.shares }, status: { ...d.status, ...s.status } } : d; });
  for (const s of saved.sets || []) if (s.custom && !sets.some(x => x.key === s.key)) sets.push({ ...common(1), ...s });
  return { ...def, ...saved, limits: { ...def.limits, ...(saved.limits || {}) }, sets };
}
export async function saveDemo(db, section) { await setSetting(db, KEY, section); return section; }
export const isOn = async (db) => !!(await getSetting(db, KEY, null))?.enabled;

// Changes to the section's own switches and limits.
export async function saveOptions(db, body) {
  const cur = await getDemo(db), next = { ...cur }, b = body || {};
  if (b.backupMaxAgeHours !== undefined) next.backupMaxAgeHours = num(b.backupMaxAgeHours, 1, 24 * 90, 'Hours before a backup counts as old');
  if (b.excludeFromBackups !== undefined) next.excludeFromBackups = !!b.excludeFromBackups;
  if (b.usePlanCeiling !== undefined) next.usePlanCeiling = !!b.usePlanCeiling;
  if (b.limits !== undefined) next.limits = cleanLimits(b.limits, cur.limits);
  await saveDemo(db, next); return { before: cur, after: next };
}
// Saves one set (an existing one, or a new Custom set when `create` is true).
export async function saveSet(db, key, body, { create = false } = {}) {
  const cur = await getDemo(db), at = cur.sets.findIndex(s => s.key === key);
  if (create) {
    const name = String(body?.name || '').trim(), k = name.toLowerCase();
    if (at >= 0 || cur.sets.some(s => s.key === k)) throw coded('DEMO_CUSTOM_BAD', { error: 'A set with that name already exists.' });
    const set = cleanSet({ ...common(Math.floor(Math.random() * 1e6)), accounts: 10, devices: { min: 10, max: 300, big: 1 }, ...body, name, key: k, custom: true }, cur.limits, { key: k, custom: true });
    cur.sets.push(set); await saveDemo(db, cur); return set;
  }
  if (at < 0) throw coded('DEMO_SET_UNKNOWN');
  const set = cleanSet({ ...cur.sets[at], ...body, devices: { ...cur.sets[at].devices, ...body?.devices }, team: { ...cur.sets[at].team, ...body?.team }, roles: { ...cur.sets[at].roles, ...body?.roles }, shares: { ...cur.sets[at].shares, ...body?.shares }, status: { ...cur.sets[at].status, ...body?.status }, name: cur.sets[at].name }, cur.limits, cur.sets[at]);
  cur.sets[at] = set; await saveDemo(db, cur); return set;
}
export async function resetSet(db, key) {
  const cur = await getDemo(db), at = cur.sets.findIndex(s => s.key === key); if (at < 0) throw coded('DEMO_SET_UNKNOWN');
  const def = defaultSets().find(s => s.key === key) || { ...common(1), key, name: cur.sets[at].name, custom: true, accounts: 10, devices: { min: 10, max: 300, big: 1 } };   // a Custom set's defaults are a small generic recipe
  cur.sets[at] = def; await saveDemo(db, cur); return def;
}
// "Reset all demo settings to defaults": every number and switch, except whether Demo mode is on and what has been built.
export async function resetAll(db) {
  const cur = await getDemo(db), def = defaultSection();
  const next = { ...def, enabled: cur.enabled, everBuilt: cur.everBuilt, lastBackupCheck: cur.lastBackupCheck };
  await saveDemo(db, next); return next;
}
export async function setEnabled(db, on) { const cur = await getDemo(db); cur.enabled = !!on; await saveDemo(db, cur); return cur; }
export async function markBuilt(db) { const cur = await getDemo(db); if (!cur.everBuilt) { cur.everBuilt = true; await saveDemo(db, cur); } }
