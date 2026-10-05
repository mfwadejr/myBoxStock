// ROUTES / host / audit — the audit trail: what Host administrators did, searchable. Built from the event log (areas host and accounts).
// It lists actions (settings changed, accounts suspended, passwords reset…), never anything from inside an account.
import express from 'express';

const AREAS = ['host', 'accounts'], PAGE = 100;
const SELECT = "SELECT e.id, e.ts, e.level, e.area, e.event, e.actor, a.account_code, e.ip, e.message FROM event_log e LEFT JOIN accounts a ON a.id = e.account_id";

function filters(query) {
  const where = [`e.area IN (${AREAS.map(() => '?').join(',')})`, "e.level <> 'debug'", "e.actor IS NOT NULL AND e.actor <> ''"], params = [...AREAS];
  const actor = String(query.actor || '').trim().toLowerCase(); if (actor) { where.push('LOWER(e.actor) = ?'); params.push(actor); }
  const from = Number(query.from), to = Number(query.to); if (from) { where.push('e.ts >= ?'); params.push(from); } if (to) { where.push('e.ts <= ?'); params.push(to); }
  const q = String(query.q || '').trim().toLowerCase().replace(/[%_\\]/g, '');
  if (q) { const like = `%${q}%`; where.push('(LOWER(e.message) LIKE ? OR LOWER(e.event) LIKE ? OR LOWER(e.actor) LIKE ? OR LOWER(e.ip) LIKE ? OR LOWER(a.account_code) LIKE ?)'); params.push(like, like, like, like, like); }
  return { where, params };
}
export function auditRoutes(db) {
  const r = express.Router();
  r.get('/actors', async (req, res) => res.json((await db.all("SELECT DISTINCT actor FROM event_log WHERE area IN ('host','accounts') AND actor IS NOT NULL AND actor <> '' ORDER BY actor LIMIT 200")).map(x => x.actor)));
  r.get('/', async (req, res) => {
    const f = filters(req.query), m = String(req.query.before || '').match(/^(\d+)_(.+)$/);
    if (m) { f.where.push('(e.ts < ? OR (e.ts = ? AND e.id < ?))'); f.params.push(Number(m[1]), Number(m[1]), m[2]); }
    const rows = await db.all(`${SELECT} WHERE ${f.where.join(' AND ')} ORDER BY e.ts DESC, e.id DESC LIMIT ${PAGE + 1}`, f.params), more = rows.length > PAGE; if (more) rows.pop();
    res.json({ rows, next: more ? `${rows.at(-1).ts}_${rows.at(-1).id}` : null });
  });
  return r;
}
