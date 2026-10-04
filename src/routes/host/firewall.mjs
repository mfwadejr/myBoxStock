// ROUTES / host / firewall — limits, address rules, bans, listening ports.
import express from 'express';
import { config as appConfig } from '../../core/config.mjs';
import * as fw from '../../security/firewall/index.mjs';

export function firewallRoutes(db) {
  const r = express.Router(), me = (req) => req.subject.username;
  r.get('/', async (req, res) => res.json({ limits: fw.getLimits(), rules: await db.all('SELECT * FROM firewall_rules ORDER BY created_at DESC'),
    ports: fw.listeningPorts(), bans: fw.listBans(), stats: fw.firewallStats(), yourIp: fw.normalizeIp(req.ip), hostAllowAny: appConfig.hostAllowAny,
    behindProxy: /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(fw.normalizeIp(req.ip)) }));
  const covered = async (ip, skipId) => (await db.all("SELECT id, cidr FROM firewall_rules WHERE kind = 'host' AND enabled = 1")).some(x => x.id !== skipId && fw.matchCidr(ip, x.cidr));
  const noLockout = (ip) => `Add a Host Console rule that includes your current address (${ip}) first, so you cannot lock yourself out.`;
  r.put('/host-access', async (req, res) => {
    const mine = fw.normalizeIp(req.ip);
    if (req.body.enabled && !appConfig.hostAllowAny && !await covered(mine)) return res.status(400).json({ error: noLockout(mine) });
    res.json(await fw.setHostAccess(db, !!req.body.enabled, me(req)));
  });

  r.put('/limits', async (req, res) => {
    const mine = fw.normalizeIp(req.ip);
    if (req.body.hostConsoleAllowOnly) { // lockout protection: you must be on the allow list first
      if (!await covered(mine)) return res.status(400).json({ error: noLockout(mine) });
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
  const guard = async (req, res) => { // never let a change leave the signed-in administrator outside the access list
    const row = await db.get('SELECT kind FROM firewall_rules WHERE id = ?', [req.params.id]);
    if (row?.kind === 'host' && fw.getLimits().hostConsoleAllowOnly && !appConfig.hostAllowAny && !await covered(fw.normalizeIp(req.ip), req.params.id)) { res.status(400).json({ error: `That rule is what lets your address (${fw.normalizeIp(req.ip)}) in. Turn the access limit off or add another rule first.` }); return true; }
  };
  r.post('/rules/:id/toggle', async (req, res) => { if (!req.body.enabled && await guard(req, res)) return; await fw.setRuleEnabled(db, req.params.id, !!req.body.enabled, me(req)); res.json({ ok: true }); });
  r.delete('/rules/:id', async (req, res) => { if (await guard(req, res)) return; await fw.removeRule(db, req.params.id, me(req)); res.json({ ok: true }); });
  r.post('/unban', async (req, res) => { fw.unban(String(req.body.ip || ''), me(req)); res.json({ ok: true }); });
  return r;
}
