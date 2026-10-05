// SERVICES / announcement — one message from the Host administrator that every customer sees as a banner in the app (maintenance notices, news).
// Stored as a platform setting. It is plain text (never HTML) and is not tied to any account's data.
import { getSetting, setSetting } from '../../db/settings.mjs';

export const LEVELS = ['info', 'warning', 'important'];
export const MAX_TEXT = 400;
const EMPTY = { enabled: false, text: '', level: 'info', until: '', id: '' };

export async function getAnnouncement(db) { return { ...EMPTY, ...(await getSetting(db, 'announcement', {})) }; }

// What the app shows right now: null when it is off, empty or past its end date (the end date is the last day it shows).
export async function activeAnnouncement(db, now = new Date()) {
  const a = await getAnnouncement(db); if (!a.enabled || !a.text.trim()) return null;
  if (a.until && a.until < now.toISOString().slice(0, 10)) return null;
  return { id: a.id, text: a.text, level: a.level };
}

// Returns an error in plain words, or '' when saved. A changed message gets a new id so people who dismissed the old one see it.
export async function saveAnnouncement(db, body) {
  const text = String(body.text ?? '').trim(), level = String(body.level || 'info'), until = String(body.until || '').trim(), enabled = !!body.enabled;
  if (!LEVELS.includes(level)) return 'Choose Information, Heads-up or Important.';
  if (text.length > MAX_TEXT) return `Keep the message to ${MAX_TEXT} characters or fewer.`;
  if (enabled && !text) return 'Write the message before turning the banner on.';
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return 'The end date must be a day, like 2026-10-31.';
  const old = await getAnnouncement(db), changed = text !== old.text || level !== old.level || until !== old.until || (enabled && !old.enabled);
  await setSetting(db, 'announcement', { enabled, text, level, until, id: changed ? String(Date.now()) : old.id });
  return '';
}
