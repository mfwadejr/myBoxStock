// ROUTES / host / firewall — limits, address rules, bans, listening ports.
import express from 'express';
import * as fw from '../../security/firewall/index.mjs';

export function firewallRoutes(db) {
  const r = express.Router(), me = (req) => req.subject.username;
  r.get('/', async (req, res) => res.json({ limits: fw.getLimits(), rules: await db.all('SELECT * FROM firewall_rules ORDER BY created_at DESC'),
    ports: fw.listeningPorts(), bans: fw.listBans(), stats: fw.firewallStats(), yourIp: fw.normalizeIp(req.ip) }));

  r.put('/limits', async (req, res) => {
    const mine = fw.normalizeIp(req.ip);
    if (req.body.hostConsoleAllowOnly) { // lockout protection: you must be on the allow list first
      const rules = await db.all("SELECT cidr FROM firewall_rules WHERE kind = 'allow' AND enabled = 1");
      if (!rules.some(x => fw.matchCidr(mine, x.cidr))) return res.status(400).json({ error: `Add an allow rule that includes your current address (${mine}) before restricting the console.` });
    }
    res.json(await fw.saveLimits(db, req.body, me(req)));
  });
  r.post('/rules', async (req, res) => {
    try {
      const mine = fw.normalizeIp(req.ip);
      if (req.body.kind === 'deny' && fw.matchCidr(mine, req.body.cidr)) return res.status(400).json({ error: `That would block your own address (${mine}).` });
      res.json({ id: await fw.addRule(db, req.body, me(req)) });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.post('/rules/:id/toggle', async (req, res) => { await fw.setRuleEnabled(db, req.params.id, !!req.body.enabled, me(req)); res.json({ ok: true }); });
  r.delete('/rules/:id', async (req, res) => { await fw.removeRule(db, req.params.id, me(req)); res.json({ ok: true }); });
  r.post('/unban', async (req, res) => { fw.unban(String(req.body.ip || ''), me(req)); res.json({ ok: true }); });
  return r;
}
