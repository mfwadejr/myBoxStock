// ROUTES / host / onboarding — how far each new account got: created, email confirmed, first sign-in, recovery key saved, plan started.
// Only facts the server already holds about identity and setup. Nothing from inside an account (the server cannot read it anyway).
import express from 'express';
import { DAY } from '../../services/billing/state.mjs';

const STEPS = [['created', 'Account created'], ['emailConfirmed', 'Email confirmed'], ['firstSignIn', 'First sign-in'], ['recoverySaved', 'Recovery key saved'], ['planStarted', 'Plan started']];

export function onboardingRoutes(db) {
  const r = express.Router();
  r.get('/', async (req, res) => {
    const days = [30, 90, 0].includes(Number(req.query.days)) ? Number(req.query.days) : 30, now = Date.now();
    const rows = await db.all(`SELECT a.id, a.account_code, a.business_name, a.plan, a.status, a.created_at,
      (SELECT COUNT(*) FROM account_users u WHERE u.account_id = a.id AND (u.email_verified_at IS NOT NULL OR u.email_grandfathered = 1)) AS email_ok,
      (SELECT COUNT(*) FROM account_users u WHERE u.account_id = a.id AND u.last_login IS NOT NULL) AS signed_in,
      (SELECT COUNT(*) FROM account_recovery rc WHERE rc.account_id = a.id AND rc.confirmed_at IS NOT NULL) AS recovery_ok
      FROM accounts a WHERE a.created_at >= ? ORDER BY a.created_at DESC LIMIT 500`, [days ? now - days * DAY : 0]);
    const accounts = rows.map(a => ({ code: a.account_code, business: a.business_name, status: a.status, createdAt: Number(a.created_at), daysSince: Math.floor((now - Number(a.created_at)) / DAY),
      steps: { created: true, emailConfirmed: Number(a.email_ok) > 0, firstSignIn: Number(a.signed_in) > 0, recoverySaved: Number(a.recovery_ok) > 0, planStarted: a.plan === 'trial' || a.plan === 'paid' } }));
    const funnel = STEPS.map(([key, label]) => ({ key, label, count: accounts.filter(a => a.steps[key]).length }));
    res.json({ days, total: accounts.length, funnel, accounts: accounts.map(a => ({ ...a, stuckAt: STEPS.find(([k]) => !a.steps[k])?.[1] || null })) });
  });
  return r;
}
