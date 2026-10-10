// SERVICES / support / settings — the lists and numbers the Host defines for support tickets (categories, priorities, canned replies, targets and limits).
import { newId } from '../../core/ids.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';

export const DEFAULTS = {
  categories: ['Question', 'Problem', 'Billing', 'Backup and restore', 'Account'],
  priorities: ['Low', 'Normal', 'High', 'Urgent'], defaultPriority: 'Normal',
  canned: [
    { id: 'c1', title: 'Looking into it', body: 'Thanks for writing to us. We are looking into this and will get back to you as soon as we know more.' },
    { id: 'c2', title: 'Please send diagnostics', body: 'To help us see what is happening, please open a new reply and use the Attach diagnostics button. It adds your app version, plan, people counts and recent warnings. It never includes inventory, customers or sales.' },
    { id: 'c3', title: 'Resolved', body: 'We believe this is sorted now. If it is not, just reply to this ticket and we will pick it up again.' },
  ],
  responseDays: 2, autoCloseDays: 7, maxFiles: 3, maxKB: 1024, perHour: 5, openCap: 10,
  // New-ticket notices to the Host (T35). Decided defaults: in-app on, email off until Email is set up and switched on, every ticket, all Host administrators, no digest, 20 emails an hour.
  notifyInApp: true, notifyEmail: false, notifyRecipients: 'all', notifyChosen: [], notifyThreshold: 'every', notifyDigest: false,
  notifyReplyInApp: true, notifyReplyEmail: false, notifyPerHour: 20,
};
export const RECIPIENTS = ['owner', 'all', 'chosen'], THRESHOLDS = ['every', 'high'];
const RANGE = { responseDays: [1, 30, 'Response target'], autoCloseDays: [1, 90, 'Days before Resolved closes'], maxFiles: [0, 5, 'Screenshots per message'], maxKB: [50, 2048, 'Screenshot size limit (KB)'], perHour: [1, 60, 'New tickets per hour'], openCap: [1, 100, 'Open tickets per account'], notifyPerHour: [1, 200, 'Notice emails per hour'] };

export async function getSupportSettings(db) {
  const saved = await getSetting(db, 'support', {}), out = { ...DEFAULTS, ...saved };
  if (!out.priorities.includes(out.defaultPriority)) out.defaultPriority = out.priorities[0];
  return out;
}

// Returns { error } in plain words, or { value } (cleaned and complete). A patch may hold any of the keys; the rest keep their saved value.
export async function cleanSupportSettings(db, patch = {}) {
  const cur = await getSupportSettings(db), next = { ...cur };
  const list = (key, label, min, max, maxLen) => {
    if (patch[key] === undefined) return null;
    const raw = Array.isArray(patch[key]) ? patch[key] : String(patch[key]).split('\n'), seen = new Set(), out = [];
    for (const x of raw.map(v => String(v).trim().replace(/\s+/g, ' ')).filter(Boolean)) { if (x.length > maxLen) return `Each ${label} can be up to ${maxLen} characters.`; if (!seen.has(x.toLowerCase())) { seen.add(x.toLowerCase()); out.push(x); } }
    if (out.length < min || out.length > max) return `Define ${min === max ? min : `${min} to ${max}`} ${label}s.`;
    next[key] = out; return null;
  };
  let bad = list('categories', 'category', 1, 12, 40) || list('priorities', 'priority', 2, 6, 24);
  if (bad) return { error: bad };
  if (patch.defaultPriority !== undefined) next.defaultPriority = String(patch.defaultPriority);
  if (!next.priorities.includes(next.defaultPriority)) next.defaultPriority = next.priorities.includes('Normal') ? 'Normal' : next.priorities[0];
  for (const [k, [lo, hi, label]] of Object.entries(RANGE)) if (patch[k] !== undefined) { const n = Number(patch[k]); if (!Number.isInteger(n) || n < lo || n > hi) return { error: `${label} must be a whole number from ${lo} to ${hi}.` }; next[k] = n; }
  for (const k of ['notifyInApp', 'notifyEmail', 'notifyDigest', 'notifyReplyInApp', 'notifyReplyEmail']) if (patch[k] !== undefined) next[k] = patch[k] === true || patch[k] === 'true';
  if (patch.notifyRecipients !== undefined) { if (!RECIPIENTS.includes(patch.notifyRecipients)) return { error: 'Choose Owner only, All Host administrators or A chosen list for the notice recipients.' }; next.notifyRecipients = patch.notifyRecipients; }
  if (patch.notifyThreshold !== undefined) { if (!THRESHOLDS.includes(patch.notifyThreshold)) return { error: 'Choose Every ticket or Only High and Urgent for the notice threshold.' }; next.notifyThreshold = patch.notifyThreshold; }
  if (patch.notifyChosen !== undefined) { if (!Array.isArray(patch.notifyChosen) || patch.notifyChosen.length > 50) return { error: 'Choose up to 50 Host administrators for the notice list.' }; next.notifyChosen = [...new Set(patch.notifyChosen.map(String))]; }
  if (next.notifyRecipients === 'chosen' && !next.notifyChosen.length && (patch.notifyRecipients !== undefined || patch.notifyChosen !== undefined)) return { error: 'Choose at least one Host administrator, or pick another recipient option.' };
  if (patch.canned !== undefined) {
    if (!Array.isArray(patch.canned) || patch.canned.length > 30) return { error: 'Keep up to 30 canned replies.' };
    const out = [];
    for (const c of patch.canned) { const title = String(c?.title || '').trim().slice(0, 60), body = String(c?.body || '').trim(); if (!title && !body) continue; if (!title || !body) return { error: 'Each canned reply needs a title and a text.' }; if (body.length > 2000) return { error: 'A canned reply can be up to 2000 characters.' }; out.push({ id: /^[\w-]{1,40}$/.test(String(c.id || '')) ? c.id : newId().slice(0, 8), title, body }); }
    next.canned = out;
  }
  return { value: next, cur };
}
export const saveSupportSettings = (db, value) => setSetting(db, 'support', value);
// What the reseller's form needs (no Host-only values).
export const formConfig = (s) => ({ categories: s.categories, maxFiles: s.maxFiles, maxKB: s.maxKB, openCap: s.openCap, responseDays: s.responseDays });
