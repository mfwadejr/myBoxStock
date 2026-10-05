// ROUTES / app / activity — sign-in history and active sessions. Everyone sees their own; account Administrators see the team's.
import express from 'express';
import { need, tenantLog } from './context.mjs';
import { describeDevice } from '../../services/signins/device.mjs';
import { sessionId } from '../../services/signins/index.mjs';

const SID = /^[0-9a-f]{16}$/;
const HIST = 'id, login, ts, result, reason, ip, device, new_ip, attempts';
const shapeHistory = (rows) => rows.map((x) => ({ ...x, ts: Number(x.ts), newIp: !!Number(x.new_ip), attempts: Number(x.attempts), new_ip: undefined }));

export function activityRoutes(db) {
  const r = express.Router();
  const sessionsFor = async (where, args, current) => (await db.all(`SELECT s.token_hash, s.subject_id, s.ip, s.ua, s.created_at, s.last_seen, u.login FROM sessions s LEFT JOIN account_users u ON u.id = s.subject_id WHERE s.realm = 'app' AND s.mfa_pending = 0 AND s.expires_at > ? AND ${where} ORDER BY COALESCE(s.last_seen, s.created_at) DESC`, [Date.now(), ...args]))
    .map((s) => ({ id: sessionId(s.token_hash), userId: s.subject_id, login: s.login, ip: s.ip, device: describeDevice(s.ua), startedAt: Number(s.created_at), lastSeen: Number(s.last_seen || s.created_at), current: s.token_hash === current }));

  r.get('/me', async (req, res) => {
    const before = Number(req.query.before) || Date.now() + 1;
    const rows = await db.all(`SELECT ${HIST} FROM sign_in_history WHERE user_id = ? AND account_id = ? AND ts < ? ORDER BY ts DESC LIMIT 51`, [req.subject.id, req.subject.account_id, before]);
    const more = rows.length > 50;
    res.json({ history: shapeHistory(rows.slice(0, 50)), more, sessions: await sessionsFor('s.subject_id = ? AND s.account_id = ?', [req.subject.id, req.subject.account_id], req.session.token_hash) });
  });
  r.post('/sessions/:sid/revoke', async (req, res) => {
    if (!SID.test(req.params.sid)) return res.status(400).json({ error: 'Bad session id.' });
    const n = await db.run("DELETE FROM sessions WHERE realm = 'app' AND subject_id = ? AND token_hash LIKE ? AND token_hash <> ?", [req.subject.id, `${req.params.sid}%`, req.session.token_hash]);
    if (n.changes) tenantLog(req, 'session.revoked', `${req.subject.login} signed out one of their own sessions`);
    res.json({ ok: n.changes > 0 });
  });
  r.get('/team', need('users.manage'), async (req, res) => {
    const before = Number(req.query.before) || Date.now() + 1;
    const rows = await db.all(`SELECT ${HIST} FROM sign_in_history WHERE account_id = ? AND ts < ? ORDER BY ts DESC LIMIT 51`, [req.subject.account_id, before]);
    res.json({ history: shapeHistory(rows.slice(0, 50)), more: rows.length > 50, sessions: await sessionsFor('s.account_id = ?', [req.subject.account_id], req.session.token_hash) });
  });
  r.post('/team/sessions/:sid/revoke', need('users.manage'), async (req, res) => {
    if (!SID.test(req.params.sid)) return res.status(400).json({ error: 'Bad session id.' });
    const n = await db.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ? AND token_hash LIKE ? AND token_hash <> ?", [req.subject.account_id, `${req.params.sid}%`, req.session.token_hash]);
    if (n.changes) tenantLog(req, 'session.revoked', `${req.subject.login} signed out a team session`);
    res.json({ ok: n.changes > 0 });
  });
  // Administrators can end every other sign-in on the account, or every one including their own.
  r.post('/team/revoke-others', need('users.manage'), async (req, res) => {
    const n = await db.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ? AND token_hash <> ?", [req.subject.account_id, req.session.token_hash]);
    tenantLog(req, 'session.revoked', `${req.subject.login} signed out everyone else (${n.changes} sign-in${n.changes === 1 ? '' : 's'})`);
    res.json({ ok: true, count: n.changes });
  });
  r.post('/team/revoke-all', need('users.manage'), async (req, res) => {
    const n = await db.run("DELETE FROM sessions WHERE realm = 'app' AND account_id = ?", [req.subject.account_id]);
    tenantLog(req, 'session.revoked', `${req.subject.login} signed out everyone, including themselves (${n.changes} sign-in${n.changes === 1 ? '' : 's'})`);
    res.json({ ok: true, count: n.changes });
  });
  return r;
}
