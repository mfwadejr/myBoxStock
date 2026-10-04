// ROUTES / host / settings — platform-wide options.
import express from 'express';
import { hostLog } from './context.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';
import { historyDays } from '../../services/signins/index.mjs';
import { siteStatus, cleanUrl } from '../../services/site/index.mjs';
import { runtimeStatus, saveRuntime } from '../../services/runtime/index.mjs';
import { trialDays } from '../../services/billing/index.mjs';

export function settingsRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ signupsEnabled: await getSetting(db, 'signups_enabled', true), trialDays: await trialDays(db), signInHistoryDays: await historyDays(db),
    database: { client: config.dbClient }, site: await siteStatus(db), runtime: await runtimeStatus(db) }));
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
