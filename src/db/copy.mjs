// DATABASE / copy — copy every table from one database to another (SQLite -> Postgres, etc.).
import { migrate, COPY_ORDER } from './schema.mjs';
import { areaLogger } from '../logging/logger.mjs';

const L = areaLogger('database');

export async function copyDatabase(src, dst, log = console.log) {
  L.info('copy.start', `Copying ${src.client} → ${dst.client}`);
  await migrate(dst);
  for (const table of COPY_ORDER) {
    const existing = await dst.get(`SELECT COUNT(*) AS n FROM ${table}`);
    if (Number(existing.n) > 0) { const m = `Target table "${table}" is not empty; migrate into a fresh database.`; L.error('copy.failed', m); throw new Error(m); }
  }
  for (const table of COPY_ORDER) {
    const rows = await src.all(`SELECT * FROM ${table}`);
    if (rows.length) {
      const cols = Object.keys(rows[0]);
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
      await dst.tx(async (t) => { for (const r of rows) await t.run(sql, cols.map(c => r[c] ?? null)); });
    }
    log(`${table}: ${rows.length} rows`);
    L.info('copy.table', `Copied ${table}: ${rows.length} rows`, { data: { table, rows: rows.length } });
  }
  L.info('copy.done', `Copy finished ${src.client} → ${dst.client}`);
}
