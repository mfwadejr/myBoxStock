// ROUTES / host / settings — platform-wide options.
import express from 'express';
import { hostLog } from './context.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';
import { trialDays } from '../../services/billing/index.mjs';

export function settingsRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ siteName: await getSetting(db, 'site_name', 'myBoxStock'), signupsEnabled: await getSetting(db, 'signups_enabled', true), trialDays: await trialDays(db),
    database: { client: config.dbClient } }));
  r.put('/', async (req, res) => {
    if (req.body.siteName !== undefined) await setSetting(db, 'site_name', String(req.body.siteName).slice(0, 80));
    if (req.body.signupsEnabled !== undefined) await setSetting(db, 'signups_enabled', !!req.body.signupsEnabled);
    if (req.body.trialDays !== undefined) {
      const n = Number(req.body.trialDays); if (!Number.isInteger(n) || n < 1 || n > 365) return res.status(400).json({ error: 'Trial length must be a whole number of days from 1 to 365.' });
      await setSetting(db, 'trial_days', n);
      hostLog(req, 'info', 'settings.trial_days', `Free trial length for new sign-ups set to ${n} days`, { data: { trialDays: n } });
    }
    hostLog(req, 'info', 'settings.updated', `Platform settings updated (site name "${req.body.siteName}", sign-ups ${req.body.signupsEnabled ? 'open' : 'closed'})`, { data: { siteName: req.body.siteName, signupsEnabled: !!req.body.signupsEnabled } });
    res.json({ ok: true });
  });
  return r;
}
