// ROUTES / host / logs — read the database copy of the event log (the future web log viewer).
// Private areas (tenant activity) are excluded: the host cannot read an account's own activity.
import express from 'express';
import { AREAS, PRIVATE_AREAS, FILE_ONLY_AREAS } from '../../logging/areas.mjs';

export function logsRoutes(db) {
  const r = express.Router();
  const visible = Object.keys(AREAS).filter(a => !PRIVATE_AREAS.includes(a));
  r.get('/areas', (req, res) => res.json(visible.map(a => ({ area: a, description: AREAS[a], inDatabase: !FILE_ONLY_AREAS.includes(a) }))));
  r.get('/', async (req, res) => {
    const where = [`area IN (${visible.map(() => '?').join(',')})`], params = [...visible];
    const area = String(req.query.area || ''); if (area) { if (!visible.includes(area)) return res.status(400).json({ error: 'Unknown area' }); where.push('area = ?'); params.push(area); }
    const level = String(req.query.level || ''); if (['debug', 'info', 'warn', 'error'].includes(level)) { where.push('level = ?'); params.push(level); }
    const q = String(req.query.q || '').trim().toLowerCase(); if (q) { where.push('(LOWER(message) LIKE ? OR LOWER(event) LIKE ? OR LOWER(actor) LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const before = Number(req.query.before); if (before) { where.push('ts < ?'); params.push(before); }
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    res.json(await db.all(`SELECT id, ts, level, area, event, actor, account_id, ip, message, raw FROM event_log WHERE ${where.join(' AND ')} ORDER BY ts DESC LIMIT ${limit}`, params));
  });
  return r;
}
