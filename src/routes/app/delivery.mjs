// ROUTES / app / delivery — a log note for delivery events that happen in the browser (a sale set to ship, marked shipped, a label printed).
// The addresses, tracking numbers and notes are encrypted in the browser and never reach this route: only the kind of event is sent.
import express from 'express';
import { can, tenantLog } from './context.mjs';
import { fail } from '../../core/messages.mjs';

const EVENTS = {
  sale: ['sales.write', 'recorded a sale for delivery (shipping, pickup or meet)'],
  shipped: ['sales.write', 'marked a sale as shipped'],
  tracking: ['sales.write', 'changed the carrier or tracking on a sale'],
  label: ['sales.read', 'opened a shipping label to print'],
  labeltest: ['sales.read', 'printed a test shipping label (sample data, no sale)'],
  loanout: ['inventory.write', 'lent a device out (demo, RMA or loan)'],
  loanin: ['inventory.write', 'took a loaned device back'],
  labelpdf: ['sales.read', 'downloaded a shipping label as a PDF'],
};

export function deliveryRoutes() {
  const r = express.Router();
  r.post('/note', (req, res) => {
    const e = String(req.body?.event || ''); if (!Object.hasOwn(EVENTS, e)) return fail(res, 400, 'DELIVERY_BAD');
    if (!can(req.subject.perms, EVENTS[e][0])) return fail(res, 403, 'PERMISSION_DENIED');
    tenantLog(req, `delivery.${e}`, `${req.subject.login} ${EVENTS[e][1]}`); res.json({ ok: true });
  });
  return r;
}
