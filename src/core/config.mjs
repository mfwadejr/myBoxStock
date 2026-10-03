// CORE / config — every environment-driven setting in one place.
import path from 'node:path';

const env = process.env;
const dataDir = env.DATA_DIR || path.resolve('data');

export const config = {
  version: '0.1.0',
  port: Number(env.PORT || 8080),
  dataDir,
  // sqlite | postgres | mysql  (mariadb is an alias for mysql)
  dbClient: (env.DB_CLIENT || 'sqlite').toLowerCase().replace('mariadb', 'mysql'),
  dbUrl: env.DATABASE_URL || '',
  dbPoolMax: Number(env.DB_POOL_MAX || 10),
  trustProxy: env.TRUST_PROXY || '',            // set to 1 behind a reverse proxy so client IPs are real
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
