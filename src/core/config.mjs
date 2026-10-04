// CORE / config — every environment-driven setting in one place.
import path from 'node:path';
import fs from 'node:fs';

const env = process.env;
// Single source of truth for the deployed version is package.json (bump it on each release).
const pkgVersion = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
const dataDir = env.DATA_DIR || path.resolve('data');

export const config = {
  version: pkgVersion,
  build: env.BUILD_ID || '', // optional: set in CI/Docker (e.g. git short sha) to show beside the version
  port: Number(env.PORT || 8080),
  dataDir,
  // sqlite | postgres | mysql  (mariadb is an alias for mysql)
  dbClient: (env.DB_CLIENT || 'sqlite').toLowerCase().replace('mariadb', 'mysql'),
  dbUrl: env.DATABASE_URL || '',
  dbPoolMax: Number(env.DB_POOL_MAX || 10),
  trustProxy: env.TRUST_PROXY || '',            // set to 1 behind a reverse proxy so client IPs are real
  hostAllowAny: env.HOST_ALLOW_ANY === '1',      // emergency switch: ignore the Host Console address list (use if you are locked out)
  secureCookies: env.SECURE_COOKIES === '1',
  publicUrl: env.PUBLIC_URL || '',
  secretKey: env.APP_SECRET || '',              // else a key is generated in DATA_DIR/secret.key
  log: {
    dir: env.LOG_DIR || path.join(dataDir, 'logs'),
    level: (env.LOG_LEVEL || 'info').toLowerCase(),   // debug | info | warn | error
    maxFileMb: Number(env.LOG_MAX_MB || 10),
    keepFiles: Number(env.LOG_FILES || 5),
    retentionDays: Number(env.LOG_RETENTION_DAYS || 90),  // database copy of the log
    console: env.LOG_CONSOLE !== '0',
  },
};

export function dbDisplay() {
  return config.dbClient === 'sqlite' ? 'SQLite (embedded)' : config.dbClient === 'postgres' ? 'PostgreSQL' : 'MariaDB / MySQL';
}
