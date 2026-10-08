// SERVICES / retention / space — "what is using space": database size and its biggest tables, log files, backup files, ticket screenshots, temporary
// files and free disk. Read-only facts. The tables named here are the Host's own; account data appears only as one size per table, never as content.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../core/config.mjs';
import { snapshot } from '../system/metrics.mjs';
import { folderBytes } from '../backup/files.mjs';
import { tempCandidates } from './prune.mjs';

const walkBytes = (dir) => { let n = 0, files = 0; const go = (d) => { let list = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of list) { const p = path.join(d, e.name); if (e.isDirectory()) go(p); else { try { n += fs.statSync(p).size; files++; } catch {} } } }; go(dir); return { bytes: n, files }; };

export async function dbFileBytes(db) {
  if (db.client === 'sqlite' && db.file) { let n = 0; for (const x of ['', '-wal']) { try { n += fs.statSync(db.file + x).size; } catch {} } return n; }
  try {
    if (db.client === 'postgres') return Number((await db.get('SELECT pg_database_size(current_database()) AS n')).n);
    if (db.client === 'mysql') return Number((await db.get('SELECT COALESCE(SUM(data_length + index_length),0) AS n FROM information_schema.tables WHERE table_schema = DATABASE()')).n);
  } catch {}
  return null;
}
// Bytes inside the SQLite file that deleted rows left behind (what Compact the database can give back).
export async function reclaimable(db) {
  if (db.client !== 'sqlite') return null;
  try { const ps = Number((await db.get('PRAGMA page_size')).page_size), fl = Number((await db.get('PRAGMA freelist_count')).freelist_count); return ps * fl; } catch { return null; }
}
async function biggestTables(db, limit = 8) {
  let rows = [];
  try {
    if (db.client === 'sqlite') rows = (await db.all("SELECT m.tbl_name AS name, SUM(d.pgsize) AS bytes FROM dbstat d JOIN sqlite_master m ON m.name = d.name WHERE m.tbl_name NOT LIKE 'sqlite_%' GROUP BY m.tbl_name ORDER BY bytes DESC LIMIT ?", [limit])).map(r => ({ name: r.name, bytes: Number(r.bytes) }));
    else if (db.client === 'postgres') rows = (await db.all("SELECT relname AS name, pg_total_relation_size(c.oid) AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = 'public' ORDER BY bytes DESC LIMIT ?", [limit])).map(r => ({ name: r.name, bytes: Number(r.bytes) }));
    else rows = (await db.all('SELECT table_name AS name, (data_length + index_length) AS bytes FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY bytes DESC LIMIT ?', [limit])).map(r => ({ name: r.name || r.NAME, bytes: Number(r.bytes ?? r.BYTES) }));
  } catch { return []; }
  for (const r of rows) { if (/^[a-z_]+$/.test(r.name)) { try { r.rows = Number((await db.get(`SELECT COUNT(*) AS n FROM ${r.name}`)).n); } catch { r.rows = null; } } }
  return rows;
}

export async function spaceUsage(db) {
  const att = await db.get('SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS bytes FROM support_attachments');
  const logs = walkBytes(config.log.dir), tmp = tempCandidates(Infinity), disk = snapshot().disk;
  return {
    database: { bytes: await dbFileBytes(db), client: db.client, reclaimable: await reclaimable(db), tables: await biggestTables(db) },
    logFiles: logs, backups: { bytes: folderBytes() },
    screenshots: { bytes: Number(att.bytes), count: Number(att.n) },
    temp: { bytes: tmp.reduce((a, x) => a + x.size, 0), count: tmp.length },
    disk: disk ? { total: disk.total, free: disk.free, used: disk.used } : null,
  };
}
