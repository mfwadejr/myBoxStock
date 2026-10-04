// ROUTES / host / links — the reseller accounts linked to the signed-in Host administrator (for the account switcher). Names only: no business data.
import express from 'express';
import { hostLog } from './context.mjs';

export function linksRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ accounts: await db.all(`SELECT u.id, u.login, u.username, a.business_name AS businessName, a.account_code AS accountCode
    FROM admin_links k JOIN account_users u ON u.id = k.user_id JOIN accounts a ON a.id = u.account_id WHERE k.admin_id = ? AND u.disabled = 0 AND a.status = 'active' AND a.host_link_allowed = 1 ORDER BY a.business_name`, [req.subject.id]) }));
  r.delete('/:id', async (req, res) => { await db.run('DELETE FROM admin_links WHERE id = ? AND admin_id = ?', [req.params.id, req.subject.id]); hostLog(req, 'info', 'hostlink.removed', 'A reseller account link was removed', { data: { id: req.params.id } }); res.json({ ok: true }); });
  return r;
}
