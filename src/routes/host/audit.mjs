// ROUTES / host / audit — the audit trail: what Host administrators did, searchable. Built from the event log (areas host and accounts).
// It lists actions (settings changed, accounts suspended, passwords reset…), never anything from inside an account.
import express from 'express';
import { AUDIT_GROUPS, auditScope, labelOf } from '../../services/audit/types.mjs';

const PAGE = 100;
const SELECT = "SELECT e.id, e.ts, e.level, e.area, e.event, e.actor, a.account_code, e.ip, e.message FROM event_log e LEFT JOIN accounts a ON a.id = e.account_id";

function filters(query) {
  const group = AUDIT_GROUPS.some(g => g.id === query.type) ? query.type : '', scope = auditScope(group);
  const where = [scope.sql, "e.level <> 'debug'"], params = [...scope.params];
  const actor = String(query.actor || '').trim().toLowerCase(); if (actor) { where.push('LOWER(e.actor) = ?'); params.push(actor); }
  const from = Number(query.from), to = Number(query.to); if (from) { where.push('e.ts >= ?'); params.push(from); } if (to) { where.push('e.ts <= ?'); params.push(to); }
  const q = String(query.q || '').trim().toLowerCase().replace(/[%_\\]/g, '');
  if (q) { const like = `%${q}%`; where.push('(LOWER(e.message) LIKE ? OR LOWER(e.event) LIKE ? OR LOWER(e.actor) LIKE ? OR LOWER(e.ip) LIKE ? OR LOWER(a.account_code) LIKE ?)'); params.push(like, like, like, like, like); }
  return { where, params };
}
export function auditRoutes(db) {
  const r = express.Router();
  r.get('/actors', async (req, res) => { const s = auditScope(); res.json((await db.all(`SELECT DISTINCT e.actor FROM event_log e WHERE ${s.sql} AND e.actor IS NOT NULL AND e.actor <> '' ORDER BY e.actor LIMIT 200`, s.params)).map(x => x.actor)); });
  r.get('/types', (req, res) => res.json(AUDIT_GROUPS));
  r.get('/', async (req, res) => {
    const f = filters(req.query), m = String(req.query.before || '').match(/^(\d+)_(.+)$/);
    const total = m ? undefined : Number((await db.get(`SELECT COUNT(*) AS n FROM event_log e LEFT JOIN accounts a ON a.id = e.account_id WHERE ${f.where.join(' AND ')}`, f.params)).n);   // counted on the first page only
    if (m) { f.where.push('(e.ts < ? OR (e.ts = ? AND e.id < ?))'); f.params.push(Number(m[1]), Number(m[1]), m[2]); }
    const rows = await db.all(`${SELECT} WHERE ${f.where.join(' AND ')} ORDER BY e.ts DESC, e.id DESC LIMIT ${PAGE + 1}`, f.params), more = rows.length > PAGE; if (more) rows.pop();
    res.json({ rows: rows.map(x => ({ ...x, label: labelOf(x.area, x.event) })), next: more ? `${rows.at(-1).ts}_${rows.at(-1).id}` : null, total });
  });
  return r;
}
