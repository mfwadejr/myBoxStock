// ROUTES / host / settings — platform-wide options.
import express from 'express';
import { hostLog } from './context.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';

export function settingsRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json({ siteName: await getSetting(db, 'site_name', 'myBoxStock'), signupsEnabled: await getSetting(db, 'signups_enabled', true),
    database: { client: config.dbClient } }));
  r.put('/', async (req, res) => {
    if (req.body.siteName !== undefined) await setSetting(db, 'site_name', String(req.body.siteName).slice(0, 80));
    if (req.body.signupsEnabled !== undefined) await setSetting(db, 'signups_enabled', !!req.body.signupsEnabled);
    hostLog(req, 'info', 'settings.updated', `Platform settings updated (site name "${req.body.siteName}", sign-ups ${req.body.signupsEnabled ? 'open' : 'closed'})`, { data: { siteName: req.body.siteName, signupsEnabled: !!req.body.signupsEnabled } });
    res.json({ ok: true });
  });
  return r;
}
