// ROUTES / host / dashboard — GET /dashboard (system resources + platform counters; no tenant business data).
import { mailTestStatus } from '../../services/mail/diagnose.mjs';
import express from 'express';
import fs from 'node:fs';
import { snapshot } from '../../services/system/metrics.mjs';
import { firewallStats } from '../../security/firewall/index.mjs';
import { billingState, DAY } from '../../services/billing/state.mjs';
import { restorePending, getFullConfig, getFullStatus, backupHealth } from '../../services/backup/index.mjs';

import { MSG } from '../../core/messages.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import { siteStatus } from '../../services/site/index.mjs';
import { getSupportSettings, summary as supportSummary } from '../../services/support/index.mjs';
import { demoTotals } from '../../services/demo/index.mjs';

const L = areaLogger('system');
export function dashboardRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => {
    // Demo accounts count in every number unless the viewer hides them (?demo=hide); `demo` below says how many there are.
    const hide = req.query.demo === 'hide', only = hide ? ' WHERE demo = 0' : '';
    const [acc, usr, act] = await Promise.all([
      db.get(`SELECT COUNT(*) AS n FROM accounts${only}`), db.get(`SELECT COUNT(*) AS n FROM account_users${hide ? ' WHERE account_id IN (SELECT id FROM accounts WHERE demo = 0)' : ''}`),
      // "Signed in now" = different people who used the app in the last 15 minutes (a sign-in itself lasts 14 days, so counting open sign-ins overstates it).
      db.get("SELECT COUNT(DISTINCT subject_id) AS n FROM sessions WHERE realm = 'app' AND mfa_pending = 0 AND expires_at > ? AND COALESCE(last_seen, created_at) > ?", [Date.now(), Date.now() - 15 * 60e3]),
    ]);
    const byStatus = await db.all(`SELECT status, COUNT(*) AS n FROM accounts${only} GROUP BY status`), mailQ = await db.all('SELECT status, COUNT(*) AS n FROM mail_queue GROUP BY status');
    const plans = { trial: 0, free: 0, paid: 0, expired: 0, endingSoon: 0 }, now = Date.now();
    for (const a of await db.all(`SELECT plan, trial_ends_at, plan_until FROM accounts${only}`)) {
      const b = billingState(a, now);
      if (!b.canWrite) plans.expired++; else plans[b.plan]++;
      if (b.canWrite && b.endsAt && b.endsAt - now <= 7 * DAY) plans.endingSoon++;
    }
    const site = await siteStatus(db);
    let health = null; try { health = await backupHealth(db); } catch (e) { L.error('dashboard.backup_health', `Could not read backup health: ${e.message}`, { data: { code: 'HOST_BACKUP_HEALTH_FAILED' } }); }
    res.json(snapshot({
      siteUrlProblem: site.problem, siteUrl: site.url, mailUntested: (await mailTestStatus(db)).needsTest,
      plans, backupHealth: health, backupHealthError: health ? null : MSG.HOST_BACKUP_HEALTH_FAILED,
      demo: await demoTotals(db), demoHidden: hide, accounts: Number(acc.n), users: Number(usr.n), activeSessions: Number(act.n),
      accountsByStatus: Object.fromEntries(byStatus.map(x => [x.status, Number(x.n)])), mail: Object.fromEntries(mailQ.map(x => [x.status, Number(x.n)])),
      support: await supportSummary(db, await getSupportSettings(db)),
      backup: { full: await getFullConfig(db), status: await getFullStatus(db) }, firewall: firewallStats(), restorePending: restorePending(), dbFileSize: db.file && fs.existsSync(db.file) ? fs.statSync(db.file).size : null,
    }));
  });
  return r;
}
