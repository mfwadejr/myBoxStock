// ROUTES / host / logs — search the database copy of the event log, page through it, and export it.
// Private areas (tenant activity) are excluded: the host cannot read an account's own activity.
// `http` is not in the database (file-only), so it is not offered here.
import express from 'express';
import { AREAS, PRIVATE_AREAS, FILE_ONLY_AREAS, LEVELS } from '../../logging/areas.mjs';
import { fail } from '../../core/messages.mjs';
import { hostLog } from './context.mjs';

const PAGE = 100, EXPORT_MAX = 5000;
const visible = Object.keys(AREAS).filter(a => !PRIVATE_AREAS.includes(a) && !FILE_ONLY_AREAS.includes(a));
const list = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);

// Builds the WHERE clause from the query string. Every value is a bound parameter.
function filters(query) {
  const where = [`e.area IN (${visible.map(() => '?').join(',')})`], params = [...visible], applied = {};
  const area = String(query.area || '');
  if (area) { if (!visible.includes(area)) return { error: 'UNKNOWN_LOG_AREA' }; where.push('e.area = ?'); params.push(area); applied.area = area; }
  const levels = list(query.level).filter(l => LEVELS[l]);
  if (levels.length) { where.push(`e.level IN (${levels.map(() => '?').join(',')})`); params.push(...levels); applied.level = levels.join(','); }
  const events = list(query.event).slice(0, 20);
  if (events.length) { where.push(`e.event IN (${events.map(() => '?').join(',')})`); params.push(...events); applied.event = events.join(','); }
  const from = Number(query.from), to = Number(query.to);
  if (from) { where.push('e.ts >= ?'); params.push(from); applied.from = from; }
  if (to) { where.push('e.ts <= ?'); params.push(to); applied.to = to; }
  const account = String(query.account || '').trim().toLowerCase();
  if (account) { where.push('LOWER(a.account_code) = ?'); params.push(account); applied.account = account; }
  const ip = String(query.ip || '').trim();
  if (ip) { where.push('e.ip = ?'); params.push(ip); applied.ip = ip; }
  const q = String(query.q || '').trim().toLowerCase().replace(/[%_\\]/g, '');
  if (q) { const like = `%${q}%`; where.push('(LOWER(e.message) LIKE ? OR LOWER(e.event) LIKE ? OR LOWER(e.actor) LIKE ? OR LOWER(e.ip) LIKE ? OR LOWER(a.account_code) LIKE ?)'); params.push(like, like, like, like, like); applied.q = q; }
  return { where, params, applied };
}
const SELECT = 'SELECT e.id, e.ts, e.level, e.area, e.event, e.actor, e.account_id, a.account_code, e.ip, e.message, e.raw FROM event_log e LEFT JOIN accounts a ON a.id = e.account_id';

export function logsRoutes(db) {
  const r = express.Router();
  r.get('/areas', (req, res) => res.json(visible.map(a => ({ area: a, description: AREAS[a] }))));

  // Newest first. `before` is the cursor returned as `next` (timestamp_id), so paging never skips or repeats a row.
  r.get('/', async (req, res) => {
    const f = filters(req.query); if (f.error) return fail(res, 400, f.error);
    const where = [...f.where], params = [...f.params];
    const m = String(req.query.before || '').match(/^(\d+)_(.+)$/);
    if (m) { where.push('(e.ts < ? OR (e.ts = ? AND e.id < ?))'); params.push(Number(m[1]), Number(m[1]), m[2]); }
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || PAGE));
    const rows = await db.all(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY e.ts DESC, e.id DESC LIMIT ${limit + 1}`, params);
    const more = rows.length > limit; if (more) rows.pop();
    if (!m) hostLog(req, 'debug', 'logs.searched', `Log search by ${req.subject.username}`, { data: f.applied });
    res.json({ rows, next: more ? `${rows.at(-1).ts}_${rows.at(-1).id}` : null });
  });

  // Download the current search (up to 5,000 rows) as CSV or JSON. Every export is itself logged.
  r.get('/export', async (req, res) => {
    const f = filters(req.query); if (f.error) return fail(res, 400, f.error);
    const fmt = req.query.format === 'json' ? 'json' : 'csv';
    const rows = await db.all(`${SELECT} WHERE ${f.where.join(' AND ')} ORDER BY e.ts DESC, e.id DESC LIMIT ${EXPORT_MAX}`, f.params);
    hostLog(req, 'info', 'logs.exported', `${req.subject.username} exported ${rows.length} log entries as ${fmt.toUpperCase()}`, { data: { ...f.applied, format: fmt, rows: rows.length } });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.set('Content-Disposition', `attachment; filename="myboxstock-logs-${stamp}.${fmt}"`);
    if (fmt === 'json') return res.type('application/json').send(JSON.stringify(rows.map(x => ({ ...x, time: new Date(Number(x.ts)).toISOString(), raw: JSON.parse(x.raw || '{}') })), null, 2));
    const q = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    res.type('text/csv').send(['time,level,area,event,actor,account,ip,message', ...rows.map(x => [new Date(Number(x.ts)).toISOString(), x.level, x.area, x.event, x.actor, x.account_code, x.ip, x.message].map(q).join(','))].join('\n'));
  });
  return r;
}
