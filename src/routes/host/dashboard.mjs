// ROUTES / host / dashboard — GET /dashboard (system resources + platform counters; no tenant business data).
import express from 'express';
import fs from 'node:fs';
import { snapshot } from '../../services/system/metrics.mjs';
import { firewallStats } from '../../security/firewall/index.mjs';
import { billingState, DAY } from '../../services/billing/state.mjs';
import { restorePending, getFullConfig, getFullStatus } from '../../services/backup/index.mjs';

export function dashboardRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => {
    const [acc, usr, act] = await Promise.all([
      db.get('SELECT COUNT(*) AS n FROM accounts'), db.get('SELECT COUNT(*) AS n FROM account_users'),
      db.get("SELECT COUNT(*) AS n FROM sessions WHERE realm = 'app' AND mfa_pending = 0 AND expires_at > ?", [Date.now()]),
    ]);
    const byStatus = await db.all('SELECT status, COUNT(*) AS n FROM accounts GROUP BY status'), mailQ = await db.all('SELECT status, COUNT(*) AS n FROM mail_queue GROUP BY status');
    const plans = { trial: 0, free: 0, paid: 0, expired: 0, endingSoon: 0 }, now = Date.now();
    for (const a of await db.all('SELECT plan, trial_ends_at, plan_until FROM accounts')) {
      const b = billingState(a, now);
      if (!b.canWrite) plans.expired++; else plans[b.plan]++;
      if (b.canWrite && b.endsAt && b.endsAt - now <= 7 * DAY) plans.endingSoon++;
    }
    res.json(snapshot({
      plans,
      accounts: Number(acc.n), users: Number(usr.n), activeSessions: Number(act.n),
      accountsByStatus: Object.fromEntries(byStatus.map(x => [x.status, Number(x.n)])), mail: Object.fromEntries(mailQ.map(x => [x.status, Number(x.n)])),
      backup: { full: await getFullConfig(db), status: await getFullStatus(db) }, firewall: firewallStats(), restorePending: restorePending(), dbFileSize: db.file && fs.existsSync(db.file) ? fs.statSync(db.file).size : null,
    }));
  });
  return r;
}
