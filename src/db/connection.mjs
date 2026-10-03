// DATABASE / connection — choose a driver from config, connect, migrate, log.
import path from 'node:path';
import { config } from '../core/config.mjs';
import { openSqlite, openPostgres, openMysql } from './drivers.mjs';
import { migrate } from './schema.mjs';
import { areaLogger } from '../logging/logger.mjs';

const L = areaLogger('database');

export async function openDb(opts = {}) {
  const client = opts.client || config.dbClient;
  const url = opts.url ?? config.dbUrl;
  try {
    let db;
    if (client === 'sqlite') db = await openSqlite(opts.file || path.join(config.dataDir, 'myboxstock.db'));
    else {
      if (!url) throw new Error(`DATABASE_URL is required when DB_CLIENT=${client}`);
      if (client === 'postgres') db = await openPostgres(url, config.dbPoolMax);
      else if (client === 'mysql') db = await openMysql(url, config.dbPoolMax);
      else throw new Error(`Unknown DB_CLIENT "${client}" (use sqlite, postgres, or mysql)`);
    }
    L.info('connected', `Connected to ${client}${db.file ? ` (${db.file})` : ''}`, { data: { client } });
    return db;
  } catch (e) { L.error('connect.failed', `Could not connect to ${client}: ${e.message}`, { data: { client } }); throw e; }
}

export async function initDb(opts) { const db = await openDb(opts); await migrate(db); return db; }
