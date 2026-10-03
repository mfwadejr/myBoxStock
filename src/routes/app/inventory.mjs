// ROUTES / app / inventory — starter slice proving per-account scoping (full model comes next).
// Every query is scoped by req.subject.account_id, which comes from the server-side session, never from client input.
import express from 'express';
import { need, tenantLog } from './context.mjs';
import { newId } from '../../core/ids.mjs';

export function inventoryRoutes(db) {
  const r = express.Router();
  r.get('/', need('inventory.read'), async (req, res) => res.json(await db.all('SELECT id, uid, serial, mac, model, cond, cost, status, notes, created_at FROM inventory_items WHERE account_id = ? ORDER BY created_at DESC LIMIT 200', [req.subject.account_id])));
  r.post('/', need('inventory.write'), async (req, res) => {
    const b = req.body; if (!b.uid && !b.serial && !b.mac) return res.status(400).json({ error: 'Enter a UID, serial number or MAC address.' });
    const id = newId();
    await db.run('INSERT INTO inventory_items (id, account_id, uid, serial, mac, model, cond, cost, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, req.subject.account_id, b.uid || null, b.serial || null, b.mac || null, b.model || null, b.cond || 'New', Math.round(Number(b.cost || 0) * 100), 'available', b.notes || null, Date.now()]);
    tenantLog(req, 'inventory.created', `${req.subject.login} added an inventory item`, { itemId: id }); // id only — never the device details
    res.json({ id });
  });
  return r;
}
