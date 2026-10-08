// SERVICES / support / attachments — screenshots only. A file is accepted when its first bytes say PNG or JPEG (the name and the type the browser claims are never trusted).
// Stored in the database as base64 text (so every snapshot, full-site backup and dump carries them), first as "pending" (no ticket yet), then attached to a message.
import { newId } from '../../core/ids.mjs';
import { MSG } from '../../core/messages.mjs';

export const coded = (code, status = 400, extra = {}) => Object.assign(new Error(MSG[code]), { code, status, extra });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], JPG = [0xff, 0xd8, 0xff];
const starts = (b, sig) => b.length > sig.length && sig.every((x, i) => b[i] === x);
export const sniff = (b) => starts(b, PNG) ? { mime: 'image/png', ext: 'png' } : starts(b, JPG) ? { mime: 'image/jpeg', ext: 'jpg' } : null;
// A safe file name: letters, numbers, dots, dashes, underscores and spaces; the extension always matches the real type.
export const cleanName = (name, ext) => (String(name || 'screenshot').split(/[\\/]/).pop().replace(/\.[^.]*$/, '').replace(/[^\w .-]/g, '').trim().slice(0, 60) || 'screenshot') + '.' + ext;
const HOUR = 3600e3;

// Reads the request body, refusing early when it is larger than `limit` bytes.
export function readBytes(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0); if (declared > limit) return reject(coded('SUPPORT_ATTACH_BIG', 413, { limitKB: Math.floor(limit / 1024) }));
    const chunks = []; let n = 0, done = false;
    req.on('data', (c) => { if (done) return; n += c.length; if (n > limit) { done = true; chunks.length = 0; reject(coded('SUPPORT_ATTACH_BIG', 413, { limitKB: Math.floor(limit / 1024) })); } else chunks.push(c); });
    req.on('end', () => { if (!done) resolve(Buffer.concat(chunks)); }); req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

// Stores one uploaded screenshot as pending for `owner` ({ kind: 'user' | 'host', id }). Returns what the page needs to show it.
export async function savePending(db, { owner, accountId = null, name, bytes, settings }) {
  if (!settings.maxFiles) throw coded('SUPPORT_ATTACH_OFF');
  if (!bytes.length) throw coded('SUPPORT_ATTACH_EMPTY');
  if (bytes.length > settings.maxKB * 1024) throw coded('SUPPORT_ATTACH_BIG', 413, { limitKB: settings.maxKB });
  const type = sniff(bytes); if (!type) throw coded('SUPPORT_ATTACH_TYPE', 415);
  await db.run('DELETE FROM support_attachments WHERE ticket_id IS NULL AND created_at < ?', [Date.now() - HOUR]);   // never-sent uploads
  const held = Number((await db.get('SELECT COUNT(*) AS n FROM support_attachments WHERE ticket_id IS NULL AND owner_kind = ? AND owner_id = ?', [owner.kind, owner.id])).n);
  if (held >= settings.maxFiles) throw coded('SUPPORT_ATTACH_COUNT', 409);
  const id = newId(), clean = cleanName(name, type.ext);
  await db.run('INSERT INTO support_attachments (id, ticket_id, message_id, account_id, owner_kind, owner_id, name, mime, size, data, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, null, null, accountId, owner.kind, owner.id, clean, type.mime, bytes.length, bytes.toString('base64'), Date.now()]);
  return { id, name: clean, mime: type.mime, size: bytes.length };
}
export const dropPending = (db, owner, id) => db.run('DELETE FROM support_attachments WHERE id = ? AND ticket_id IS NULL AND owner_kind = ? AND owner_id = ?', [id, owner.kind, owner.id]);

// Checks that every id is a pending upload of this owner (and within the limit) before anything is written. Returns the ids.
export async function claimable(db, owner, ids, settings) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  if (list.length > settings.maxFiles) throw coded(settings.maxFiles ? 'SUPPORT_ATTACH_COUNT' : 'SUPPORT_ATTACH_OFF', 409);
  for (const id of list) if (!await db.get('SELECT id FROM support_attachments WHERE id = ? AND ticket_id IS NULL AND owner_kind = ? AND owner_id = ?', [id, owner.kind, owner.id])) throw coded('SUPPORT_ATTACH_GONE', 409);
  return list;
}
export const attach = (t, ids, ticketId, messageId) => Promise.all(ids.map(id => t.run('UPDATE support_attachments SET ticket_id = ?, message_id = ? WHERE id = ?', [ticketId, messageId, id])));
export const metaFor = (db, ticketId) => db.all('SELECT id, message_id, name, mime, size FROM support_attachments WHERE ticket_id = ? ORDER BY created_at', [ticketId]);
// Sends the picture bytes. Served as its own type with nosniff and a sandboxing policy, so a file can never run as a page.
export async function send(db, res, row) {
  const data = await db.get('SELECT data FROM support_attachments WHERE id = ?', [row.id]);
  res.set({ 'Content-Type': row.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, max-age=300', 'Content-Disposition': `inline; filename="${row.name.replace(/"/g, '')}"` });
  res.send(Buffer.from(data.data, 'base64'));
}
