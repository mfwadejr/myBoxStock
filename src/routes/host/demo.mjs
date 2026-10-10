// ROUTES / host / demo — the "Demo mode" page: the on/off switch, the size sets and their recipes, the backup-before-Build prompt, Build / Remove / Reset demo as background jobs, and the
// demo logins table (Show, Copy, Open, Reset password). Visible to every Host administrator; changing anything, and every password action, needs the Owner or Administrator role.
// Only demo-tagged accounts are ever touched (see services/demo). Every change, build, removal and password action is written to the audit trail; passwords never reach a log.
import express from 'express';
import { fail, MSG } from '../../core/messages.mjs';
import { hostLog } from './context.mjs';
import { snapshot } from '../../services/system/metrics.mjs';
import { backupBusy, publicJob, currentJob } from '../../services/backup/index.mjs';
import * as demo from '../../services/demo/index.mjs';

const STATUS = { DEMO_ROLE: 403, DEMO_OVERRIDE_OWNER: 403, DEMO_OFF: 409, DEMO_ALREADY_BUILT: 409, DEMO_NAME_CLASH: 409, DEMO_BACKUP_NEEDED: 409, HOST_JOB_RUNNING: 409, DEMO_SET_UNKNOWN: 404, DEMO_LOGIN_UNKNOWN: 404, DEMO_NOT_BUILT: 404 };

export function demoRoutes(db) {
  const r = express.Router();
  const ownerId = async () => (await db.get('SELECT id FROM host_admins ORDER BY created_at, id LIMIT 1'))?.id;
  const manager = (req) => demo.canManage(req.subject);   // Owner and Administrator roles only
  const who = (req) => ({ actor: req.subject.username, ip: req.ip });
  const refused = (req, what, code) => demo.audit('demo.refused', `${what} was refused (${code})`, { ...who(req), level: 'warn', data: { code } });
  const wrap = (fn, { manage = true, what = 'A demo action' } = {}) => async (req, res, next) => {
    try {
      if (manage && !manager(req)) { refused(req, what, 'DEMO_ROLE'); return fail(res, 403, 'DEMO_ROLE'); }
      await fn(req, res, next);
    } catch (e) {
      if (e?.code && MSG[e.code]) {
        if (manage) refused(req, what, e.code);
        const extra = {}; for (const k of ['error', 'by', 'clashes', 'estimate', 'need', 'free', 'state']) if (e[k] !== undefined) extra[k] = e[k];
        return fail(res, e.status || STATUS[e.code] || 400, e.code, extra);
      }
      next(e);
    }
  };
  const setOf = async (key) => { const s = (await demo.getDemo(db)).sets.find(x => x.key === String(key)); if (!s) throw demo.coded('DEMO_SET_UNKNOWN'); return s; };
  const view = async (req) => {
    const sec = await demo.getDemo(db), built = await demo.builtStats(db), ceiling = await demo.planCeiling(db, sec), disk = snapshot().disk;
    const defaults = Object.fromEntries(demo.defaultSets().map(s => [s.key, s]));
    return {
      canManage: manager(req), isOwner: req.subject.id === await ownerId(), enabled: sec.enabled, everBuilt: sec.everBuilt,
      options: { backupMaxAgeHours: sec.backupMaxAgeHours, excludeFromBackups: sec.excludeFromBackups, usePlanCeiling: sec.usePlanCeiling, limits: sec.limits },
      sets: sec.sets.map(s => ({ ...s, built: built[s.key] || null, estimate: demo.estimate(s, { ceiling }), defaults: defaults[s.key] || null })),
      backup: await demo.backupState(db), overrideText: demo.OVERRIDE_TEXT, job: publicJob(currentJob()), busy: backupBusy(),
      disk: disk ? { free: disk.free, total: disk.total } : null, realAccounts: Number((await db.get('SELECT COUNT(*) AS n FROM accounts WHERE demo = 0')).n), sqlite: db.client === 'sqlite',
      totals: await demo.demoTotals(db),
    };
  };
  r.get('/', wrap(async (req, res) => res.json(await view(req)), { manage: false }));

  r.get('/backup', wrap(async (req, res) => res.json({ backup: await demo.backupState(db), overrideText: demo.OVERRIDE_TEXT }), { manage: false }));

  r.put('/enabled', wrap(async (req, res) => {
    const on = !!req.body?.enabled, sec = await demo.getDemo(db);
    if (on !== sec.enabled) {
      await demo.setEnabled(db, on);
      if (!on) await db.run("DELETE FROM sessions WHERE realm = 'app' AND account_id IN (SELECT id FROM accounts WHERE demo = 1)");   // demo sign-ins end with Demo mode
      demo.audit(on ? 'demo.enabled' : 'demo.disabled', `Demo mode switched ${on ? 'on' : 'off'}${on ? '' : '; demo sign-ins ended and demo logins stop working'}`, { ...who(req), level: 'warn' });
    }
    res.json({ ok: true, enabled: on });
  }, { what: 'Switching Demo mode' }));

  r.put('/options', wrap(async (req, res) => {
    const { before, after } = await demo.saveOptions(db, req.body);
    demo.audit('demo.settings', `Demo mode options changed: backup age ${after.backupMaxAgeHours} h, backups ${after.excludeFromBackups ? 'leave out' : 'include'} demo accounts, real plans as a ceiling ${after.usePlanCeiling ? 'on' : 'off'}`, { ...who(req), data: { before: { ...before, sets: undefined }, after: { ...after, sets: undefined } } });
    res.json({ ok: true });
  }, { what: 'A change to the Demo mode options' }));

  r.put('/sets/:key', wrap(async (req, res) => {
    const set = await demo.saveSet(db, String(req.params.key), req.body);
    demo.audit('demo.settings', `Demo set ${set.name} changed: ${set.accounts} accounts, ${set.devices.min} to ${set.devices.max} devices, seed ${set.seed}`, { ...who(req), data: { set: set.key } });
    res.json({ ok: true, set });
  }, { what: 'A change to a demo set' }));
  r.post('/sets', wrap(async (req, res) => {
    const set = await demo.saveSet(db, '', req.body, { create: true });
    demo.audit('demo.settings', `Custom demo set ${set.name} added: ${set.accounts} accounts`, { ...who(req), data: { set: set.key } });
    res.json({ ok: true, set });
  }, { what: 'Adding a custom demo set' }));
  r.post('/sets/:key/reset', wrap(async (req, res) => {
    const set = await demo.resetSet(db, String(req.params.key));
    demo.audit('demo.settings_reset', `Demo set ${set.name || req.params.key} reset to its defaults`, { ...who(req), data: { set: set.key } });
    res.json({ ok: true, set });
  }, { what: 'Resetting a demo set to its defaults' }));
  r.delete('/sets/:key', wrap(async (req, res) => {
    const s = await setOf(req.params.key); if (!s.custom) throw demo.coded('DEMO_CUSTOM_BAD', { error: 'Only a Custom set can be deleted from the list.' });
    if ((await demo.builtStats(db))[s.key]) throw demo.coded('DEMO_ALREADY_BUILT', { error: 'This set still has accounts. Remove them first.' });
    const sec = await demo.getDemo(db); sec.sets = sec.sets.filter(x => x.key !== s.key); await demo.saveDemo(db, sec);
    demo.audit('demo.settings', `Custom demo set ${s.name} deleted from the list`, { ...who(req), data: { set: s.key } });
    res.json({ ok: true });
  }, { what: 'Deleting a custom demo set' }));
  r.post('/reset-settings', wrap(async (req, res) => {
    await demo.resetAll(db); demo.audit('demo.settings_reset', 'All demo settings reset to their defaults (Custom sets removed from the list; nothing built was touched)', { ...who(req), level: 'warn' });
    res.json({ ok: true });
  }, { what: 'Resetting all demo settings' }));

  // The live estimate and the safety checks for a recipe, before anything is built. The recipe may be edited and not saved yet.
  r.post('/estimate', wrap(async (req, res) => {
    const sec = await demo.getDemo(db), base = sec.sets.find(s => s.key === String(req.body?.key));
    if (!base) throw demo.coded('DEMO_SET_UNKNOWN');
    const rc = req.body?.recipe || {}, set = demo.cleanSet({ ...base, ...rc, devices: { ...base.devices, ...rc.devices }, team: { ...base.team, ...rc.team }, roles: { ...base.roles, ...rc.roles }, shares: { ...base.shares, ...rc.shares }, status: { ...base.status, ...rc.status }, name: base.name }, sec.limits, base);
    const est = demo.estimate(set, { ceiling: await demo.planCeiling(db, sec) });
    let problem = null; try { await demo.checkBuild(db, set, { section: sec, ceiling: await demo.planCeiling(db, sec), requireOn: false }); } catch (e) { if (!e.code) throw e; problem = { code: e.code, message: e.error || e.message, clashes: e.clashes || null }; }
    res.json({ estimate: est, problem, heavy: est.accounts >= 1000, backup: await demo.backupState(db) });
  }, { manage: false }));

  r.post('/build', wrap(async (req, res) => {
    const set = await setOf(req.body?.set), sec = await demo.getDemo(db);
    if (!sec.enabled) throw demo.coded('DEMO_OFF');
    await demo.requireBackup(db, { confirm: String(req.body?.backupConfirm || ''), isOwner: req.subject.id === await ownerId(), ...who(req), what: `building ${set.name}` });
    const job = await demo.startBuild(db, set.key, who(req));
    res.status(202).json({ job: publicJob(job) });
  }, { what: 'A demo Build' }));

  r.get('/preview', wrap(async (req, res) => res.json({ ...(await demo.previewRemove(db, req.query.set ? String(req.query.set) : null)), backup: await demo.backupState(db) }), { manage: false }));
  r.post('/remove', wrap(async (req, res) => {
    const set = req.body?.set ? String(req.body.set) : null; if (set && !(await demo.builtStats(db))[set]) throw demo.coded('DEMO_NOT_BUILT');
    if (req.body?.confirm !== 'REMOVE') throw demo.coded('DEMO_CONFIRM');
    await demo.requireBackup(db, { confirm: String(req.body?.backupConfirm || ''), isOwner: req.subject.id === await ownerId(), ...who(req), what: 'removing demo data' });
    const job = await demo.startRemove(db, { set, ...who(req) });
    res.status(202).json({ job: publicJob(job) });
  }, { what: 'Removing demo data' }));
  r.post('/reset', wrap(async (req, res) => {
    const set = req.body?.set ? String(req.body.set) : null;
    if (!(await demo.getDemo(db)).enabled) throw demo.coded('DEMO_OFF');
    if (req.body?.confirm !== 'RESET') throw demo.coded('DEMO_CONFIRM');
    await demo.requireBackup(db, { confirm: String(req.body?.backupConfirm || ''), isOwner: req.subject.id === await ownerId(), ...who(req), what: 'resetting demo data' });
    const job = await demo.startReset(db, { set, ...who(req) });
    res.status(202).json({ job: publicJob(job) });
  }, { what: 'Reset demo' }));

  // ---- the demo logins table ----
  r.get('/logins', wrap(async (req, res) => res.json({ sets: await demo.credentialRows(db), enabled: (await demo.getDemo(db)).enabled, canManage: manager(req), isOwner: req.subject.id === await ownerId() }), { manage: false }));
  const loginAction = (event, verb, fn) => wrap(async (req, res) => {
    const x = await demo.passwordOf(db, req.params.id);   // read first, so an unknown login stops here
    demo.audit(event, `${verb} the password of the demo login ${x.login}`, { ...who(req), level: 'warn', data: { set: x.set, login: x.login } });   // logged before anything is returned; the password itself is never logged
    await fn(req, res, x);
  }, { what: `${verb} a demo password` });
  r.post('/logins/:id/show', loginAction('demo.password_show', 'Showed', (req, res, x) => res.json({ password: x.password })));
  r.post('/logins/:id/copy', loginAction('demo.password_copy', 'Copied', (req, res, x) => res.json({ password: x.password })));
  r.post('/logins/:id/open', wrap(async (req, res) => {
    const x = await demo.passwordOf(db, req.params.id);
    if (!(await demo.getDemo(db)).enabled) throw demo.coded('DEMO_OFF');
    if (x.kind === 'filler') throw demo.coded('DEMO_LOGIN_UNKNOWN', { error: 'Open as a named login (Owner, Standard or View).' });
    demo.audit('demo.open', `Opened the demo login ${x.login} from the Host console`, { ...who(req), level: 'warn', data: { set: x.set, login: x.login } });
    res.json({ url: `/app/#/demo/${demo.makeTicket(req.params.id)}` });
  }, { what: 'Opening a demo login' }));
  r.post('/logins/:id/reset', wrap(async (req, res) => {
    const x = await demo.passwordOf(db, req.params.id), own = req.body?.password ? String(req.body.password) : '';
    if (own && req.subject.id !== await ownerId()) throw demo.coded('DEMO_OVERRIDE_OWNER', { error: 'Only the Owner administrator can choose a password. Leave it empty to generate one.' });
    const out = await demo.resetPassword(db, req.params.id, { password: own });
    demo.audit('demo.password_reset', `Reset the password of the demo login ${x.login}${own ? ' (chosen by the Owner)' : ' (generated)'}${x.kind === 'filler' ? `, ${out.people} people in the set` : ''}`, { ...who(req), level: 'warn', data: { set: x.set, login: x.login, chosen: !!own } });
    res.json({ ok: true, password: out.password });
  }, { what: 'Resetting a demo password' }));
  return r;
}
