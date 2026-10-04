// ROUTES / host / settings — platform-wide options.
import express from 'express';
import { hostLog } from './context.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';
import { historyDays } from '../../services/signins/index.mjs';
import { trialDays } from '../../services/billing/index.mjs';

export function settingsRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ signupsEnabled: await getSetting(db, 'signups_enabled', true), trialDays: await trialDays(db), signInHistoryDays: await historyDays(db),
    database: { client: config.dbClient } }));
  r.put('/', async (req, res) => {
    if (req.body.signupsEnabled !== undefined) await setSetting(db, 'signups_enabled', !!req.body.signupsEnabled);
    if (req.body.trialDays !== undefined) {
      const n = Number(req.body.trialDays); if (!Number.isInteger(n) || n < 1 || n > 365) return res.status(400).json({ error: 'Trial length must be a whole number of days from 1 to 365.' });
      await setSetting(db, 'trial_days', n);
      hostLog(req, 'info', 'settings.trial_days', `Free trial length for new sign-ups set to ${n} days`, { data: { trialDays: n } });
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
