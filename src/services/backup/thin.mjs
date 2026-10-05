// SERVICES / backup / thin — decides which copies of a frequent set to keep: every copy for a while, then one an hour, one a day, one a week.
// Pure functions (no files, no clock) so the rule is easy to test. Defaults give about 166 files: 96 + 48 + 14 + 8.
export const DEFAULT_THIN = { fullHours: 24, hourlyHours: 48, dailyDays: 14, weeklyWeeks: 8 };
const HOUR = 3600e3, DAY = 24 * HOUR, WEEK = 7 * DAY;
const LIMITS = { fullHours: [1, 168, 'hours to keep every copy'], hourlyHours: [0, 720, 'hours to keep one copy an hour'], dailyDays: [0, 365, 'days to keep one copy a day'], weeklyWeeks: [0, 520, 'weeks to keep one copy a week'] };

// Returns a clean policy or throws a plain-English error naming the field.
export function thinPolicy(input = {}, { strict = true } = {}) {
  const out = {};
  for (const [k, [lo, hi, what]] of Object.entries(LIMITS)) {
    const raw = input[k] ?? DEFAULT_THIN[k], n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < lo || n > hi) {
      if (strict) throw new Error(`Enter a whole number from ${lo} to ${hi} for the ${what}.`);
      out[k] = Math.min(hi, Math.max(lo, Math.floor(n) || DEFAULT_THIN[k]));
    } else out[k] = n;
  }
  return out;
}
// items: [{ name, t }] with t in ms. Returns { keep, drop } (arrays of items). The newest copy is always kept.
export function thin(items, policy, now = Date.now()) {
  const p = thinPolicy(policy, { strict: false }), keep = [], drop = [], buckets = new Map();
  const edge1 = p.fullHours * HOUR, edge2 = edge1 + p.hourlyHours * HOUR, edge3 = edge2 + p.dailyDays * DAY, edge4 = edge3 + p.weeklyWeeks * WEEK;
  const sorted = [...items].sort((a, b) => a.t - b.t);
  const newest = sorted.at(-1);
  for (const it of sorted) {
    const age = now - it.t; let key = null;
    if (age <= edge1) { keep.push(it); continue; }
    if (age <= edge2) key = `h${Math.floor(it.t / HOUR)}`;
    else if (age <= edge3) key = `d${Math.floor(it.t / DAY)}`;
    else if (age <= edge4) key = `w${Math.floor((it.t - 4 * DAY) / WEEK)}`; // weeks start on Monday
    if (key === null) { (it === newest ? keep : drop).push(it); continue; }
    if (buckets.has(key)) (it === newest ? keep : drop).push(it); // the earliest copy in each hour, day or week stays, so a kept copy is never dropped later
    else { buckets.set(key, it); keep.push(it); }
  }
  return { keep, drop };
}
// How many files the policy holds at most when a copy is made every `everyMinutes` minutes.
export function steadyCount(everyMinutes, policy) {
  const p = thinPolicy(policy, { strict: false }), perHour = 60 / everyMinutes;
  return Math.ceil(p.fullHours * perHour) + Math.ceil(p.hourlyHours * Math.min(1, perHour)) + Math.ceil(p.dailyDays * Math.min(24 * perHour, 1)) + Math.ceil(p.weeklyWeeks * Math.min(7 * 24 * perHour, 1));
}
