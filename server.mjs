// myBoxStock — process entry point. Wiring only; every feature lives in src/<function>/.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/core/config.mjs';
import { areaLogger, attachLogDb, closeLogs, pruneEventLog } from './src/logging/logger.mjs';
import { accessLog } from './src/logging/access-log.mjs';
import { runCli } from './src/cli/commands.mjs';
import { ensureHostAdmin } from './src/cli/host-admin.mjs';
import { initDb } from './src/db/connection.mjs';
import { applyPendingRestore, startBackupScheduler } from './src/services/backup/index.mjs';
import { startMailWorker } from './src/services/mail/index.mjs';
import { loadFirewall, firewallMiddleware } from './src/security/firewall/index.mjs';
import { purgeExpired } from './src/auth/session.mjs';
import { sweepClosing } from './src/services/accounts/closing.mjs';
import { sweepExpired } from './src/services/billing/index.mjs';
import { purgeSignInHistory } from './src/services/signins/index.mjs';
import { hostRouter } from './src/routes/host/index.mjs';
import { appRouter } from './src/routes/app/index.mjs';

if (await runCli(process.argv[2])) process.exit(process.exitCode || 0);

const L = areaLogger('system'), E = areaLogger('error');
const here = path.dirname(fileURLToPath(import.meta.url));

if (config.dbClient === 'sqlite') applyPendingRestore(path.join(config.dataDir, 'myboxstock.db'));
const db = await initDb();
attachLogDb(db);
const firstPw = await ensureHostAdmin(db);
await loadFirewall(db);
startMailWorker(db); startBackupScheduler(db);
sweepExpired(db).catch(() => {});
sweepClosing(db).catch((e) => E.error('closing.sweep', e.message));
setInterval(() => sweepClosing(db).catch((e) => E.error('closing.sweep', e.message)), config.closingSweepMs).unref();
setInterval(() => sweepExpired(db).catch(() => {}), 3600e3).unref();
purgeSignInHistory(db).catch(() => {});
setInterval(() => purgeSignInHistory(db).catch(() => {}), 6 * 3600e3).unref();
setInterval(() => purgeExpired(db).catch(() => {}), 3600e3).unref();
setInterval(() => pruneEventLog().then(n => n && L.info('log.pruned', `Removed ${n} log rows older than ${config.log.retentionDays} days`)).catch(() => {}), 24 * 3600e3).unref();

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
app.use(accessLog);
app.use((req, res, next) => { // security headers; style-src has no 'unsafe-inline' — all styling comes from /css
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'" });
  next();
});
app.use(firewallMiddleware);
app.use('/api/app/vault', express.json({ limit: '4mb' })); // encrypted records can be sent in large batches
app.use(express.json({ limit: '100kb' }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/host', hostRouter(db));
app.use('/api/app', appRouter(db));
app.get('/healthz', (req, res) => res.json({ ok: true, version: config.version, build: config.build || null }));
app.use(express.static(path.join(here, 'public')));
app.get('/', (req, res) => res.redirect('/app/'));
app.use((err, req, res, next) => { // anything unhandled ends up here — logged with the stack in the error area
  E.error('unhandled', `${req.method} ${req.path} failed: ${err.message}`, { actor: req.subject?.login || req.subject?.username, ip: req.ip, data: { stack: String(err.stack).split('\n').slice(0, 8), path: req.path } });
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const server = app.listen(config.port, () => {
  L.info('started', `myBoxStock ${config.version} listening on :${config.port} (database: ${config.dbClient}, logs: ${config.log.dir})`, { data: { port: config.port, db: config.dbClient, node: process.version } });
  if (firstPw) console.log(`\n=== FIRST RUN ===\nHost console: /host/\nUsername: admin\nTemporary password: ${firstPw}\nYou will be asked to change it, and to set up two-factor, at first sign-in.\n=================\n`);
});

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => {
  L.info('stopping', `Received ${sig}; shutting down`);
  server.close(); await closeLogs(); await db.close().catch(() => {}); process.exit(0);
});
process.on('uncaughtException', (e) => { E.error('uncaught', e.message, { data: { stack: String(e.stack).split('\n').slice(0, 8) } }); });
process.on('unhandledRejection', (e) => { E.error('unhandled_rejection', String(e?.message || e), { data: { stack: String(e?.stack || '').split('\n').slice(0, 8) } }); });
