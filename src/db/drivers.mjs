// DATABASE / drivers — three interchangeable drivers behind one tiny interface:
//   all(sql, params) -> rows[]     get(sql, params) -> row|undefined
//   run(sql, params) -> {changes}  exec(ddl)        tx(fn)  close()
// All SQL in the app is written with `?` placeholders; the Postgres driver rewrites them.
// NOTE (SQLite): one connection is shared, so transaction bodies must only await db calls (no network/disk waits).
import fs from 'node:fs';
import path from 'node:path';

function toPg(sql) { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); }

export async function openSqlite(file) {
  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  let chain = Promise.resolve(); // serialize transactions on the single connection
  const api = {
    client: 'sqlite', file, raw,
    async all(sql, p = []) { return raw.prepare(sql).all(...p); },
    async get(sql, p = []) { return raw.prepare(sql).get(...p); },
    async run(sql, p = []) { const r = raw.prepare(sql).run(...p); return { changes: Number(r.changes) }; },
    async exec(ddl) { raw.exec(ddl); },
    tx(fn) {
      const next = chain.then(async () => {
        raw.exec('BEGIN IMMEDIATE');
        try { const out = await fn(api); raw.exec('COMMIT'); return out; }
        catch (e) { try { raw.exec('ROLLBACK'); } catch {} throw e; }
      });
      chain = next.catch(() => {});
      return next;
    },
    async close() { raw.close(); },
  };
  return api;
}

export async function openPostgres(url, max) {
  const pg = (await import('pg')).default;
  pg.types.setTypeParser(20, v => Number(v)); // BIGINT -> number
  const pool = new pg.Pool({ connectionString: url, max });
  const wrap = (q) => ({
    client: 'postgres',
    async all(sql, p = []) { return (await q.query(toPg(sql), p)).rows; },
    async get(sql, p = []) { return (await q.query(toPg(sql), p)).rows[0]; },
    async run(sql, p = []) { const r = await q.query(toPg(sql), p); return { changes: r.rowCount }; },
    async exec(ddl) { await q.query(ddl); },
  });
  const api = {
    ...wrap(pool), pool,
    async tx(fn) {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const out = await fn(wrap(c)); await c.query('COMMIT'); return out; }
      catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; }
      finally { c.release(); }
    },
    async close() { await pool.end(); },
  };
  return api;
}

export async function openMysql(url, max) {
  const mysql = (await import('mysql2/promise')).default;
  const pool = mysql.createPool({ uri: url, connectionLimit: max, supportBigNumbers: true, bigNumberStrings: false, multipleStatements: true });
  const wrap = (q) => ({
    client: 'mysql',
    async all(sql, p = []) { const [rows] = await q.query(sql, p); return rows; },
    async get(sql, p = []) { const [rows] = await q.query(sql, p); return rows[0]; },
    async run(sql, p = []) { const [r] = await q.query(sql, p); return { changes: r.affectedRows }; },
    async exec(ddl) { await q.query(ddl); },
  });
  return {
    ...wrap(pool), pool,
    async tx(fn) {
      const c = await pool.getConnection();
      try { await c.beginTransaction(); const out = await fn(wrap(c)); await c.commit(); return out; }
      catch (e) { try { await c.rollback(); } catch {} throw e; }
      finally { c.release(); }
    },
    async close() { await pool.end(); },
  };
}
