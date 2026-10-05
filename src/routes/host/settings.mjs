// ROUTES / host / settings — platform-wide options.
import express from 'express';
import { hostLog } from './context.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';
import * as fw from '../../security/firewall/index.mjs';
import { historyDays } from '../../services/signins/index.mjs';
import { siteStatus, cleanUrl } from '../../services/site/index.mjs';
import { runtimeStatus, saveRuntime, addressWith } from '../../services/runtime/index.mjs';
import { trialDays } from '../../services/billing/index.mjs';
import { getAnnouncement, saveAnnouncement } from '../../services/announcement/index.mjs';

export function settingsRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ signupsEnabled: await getSetting(db, 'signups_enabled', true), trialDays: await trialDays(db), signInHistoryDays: await historyDays(db),
    database: { client: config.dbClient }, site: await siteStatus(db), runtime: await runtimeStatus(db), announcement: await getAnnouncement(db) }));
  // The banner every customer sees at the top of the app.
  r.put('/announcement', async (req, res) => {
    const bad = await saveAnnouncement(db, req.body || {}); if (bad) return res.status(400).json({ error: bad });
    hostLog(req, 'info', 'settings.announcement', req.body.enabled ? 'Announcement banner turned on' : 'Announcement banner turned off', { data: { enabled: !!req.body.enabled, level: req.body.level } });
    res.json({ ok: true });
  });
  r.put('/', async (req, res) => {
    if (req.body.signupsEnabled !== undefined) await setSetting(db, 'signups_enabled', !!req.body.signupsEnabled);
    if (req.body.trialDays !== undefined) {
      const n = Number(req.body.trialDays); if (!Number.isInteger(n) || n < 1 || n > 365) return res.status(400).json({ error: 'Trial length must be a whole number of days from 1 to 365.' });
      await setSetting(db, 'trial_days', n);
      hostLog(req, 'info', 'settings.trial_days', `Free trial length for new sign-ups set to ${n} days`, { data: { trialDays: n } });
    }
    if (req.body.siteUrl !== undefined) {
      const u = cleanUrl(req.body.siteUrl);
      if (u) { let x; try { x = new URL(u); } catch { return res.status(400).json({ error: 'That is not a web address. Use the form https://app.example.com' }); } if (!/^https?:$/.test(x.protocol) || (x.pathname !== '/' && x.pathname !== '') || x.search || x.hash) return res.status(400).json({ error: 'Use just the address, like https://app.example.com (no path).' }); }
      await setSetting(db, 'site_url', u);
      hostLog(req, 'info', 'settings.site_url', u ? `Site address for email links set to ${u}` : 'Site address cleared (the PUBLIC_URL setting is used)', { data: { siteUrl: u } });
    }
    if (req.body.runtime) {
      // A proxy count changes which address the server sees for you. Refuse a change that would put you outside the Host Console list.
      if ('trustProxy' in req.body.runtime && req.body.runtime.trustProxy !== null && !config.hostAllowAny) {
        const now = fw.normalizeIp(req.ip), then = fw.normalizeIp(addressWith(req, req.body.runtime.trustProxy));
        if (then !== now) {
          const rules = fw.getRules(), listed = rules.some(r => r.kind === 'host' && fw.matchCidr(then, r.cidr)), denied = rules.some(r => r.kind === 'deny' && fw.matchCidr(then, r.cidr)) && !rules.some(r => r.kind === 'allow' && fw.matchCidr(then, r.cidr));
          if ((fw.getLimits().hostConsoleAllowOnly && !listed) || denied) return res.status(400).json({ error: `With that proxy count the site would see your address as ${then} instead of ${now}, and ${then} is not allowed into the Host Console, so you would be locked out. Add a Host Console rule for ${then} first (Firewall), then change this.`, code: 'PROXY_LOCKOUT' });
        }
      }
      const bad = await saveRuntime(db, req.app, req.body.runtime, { secure: req.secure });
      if (bad) return res.status(400).json({ error: bad });
      hostLog(req, 'info', 'settings.runtime', `Server options changed (${Object.keys(req.body.runtime).join(', ')})`, { data: { keys: Object.keys(req.body.runtime) } });
    }
    if (req.body.signInHistoryDays !== undefined) {
      const n = Number(req.body.signInHistoryDays); if (!Number.isInteger(n) || n < 7 || n > 730) return res.status(400).json({ error: 'Sign-in history must be kept for a whole number of days from 7 to 730.' });
      await setSetting(db, 'sign_in_history_days', n);
      hostLog(req, 'info', 'settings.sign_in_history_days', `Sign-in history retention set to ${n} days`, { data: { days: n } });
    }
    hostLog(req, 'info', 'settings.updated', `Platform settings updated (sign-ups ${req.body.signupsEnabled ? 'open' : 'closed'})`, { data: { signupsEnabled: !!req.body.signupsEnabled } });
    res.json({ ok: true });
  });
  return r;
}
