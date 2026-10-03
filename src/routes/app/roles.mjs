// ROUTES / app / roles — user types (Administrator / Standard / View) available in the account.
import express from 'express';

export function rolesRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json((await db.all('SELECT id, name, perms, builtin FROM account_roles WHERE account_id = ?', [req.subject.account_id])).map(x => ({ ...x, perms: JSON.parse(x.perms) }))));
  return r;
}
