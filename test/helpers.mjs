// TEST / helpers — start a real server on a temp data dir, and a tiny cookie-jar HTTP client.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// When testing against PostgreSQL, give every server its own schema so test files don't share tables.
async function isolatedDbEnv() {
  if (process.env.DB_CLIENT !== 'postgres' || !process.env.DATABASE_URL) return {};
  const { default: pg } = await import('pg'), schema = 's_' + Math.random().toString(36).slice(2, 10);
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); await c.query(`CREATE SCHEMA ${schema}`); await c.end();
  const base = process.env.DATABASE_URL; // %20 (not +) so libpq tools such as pg_dump parse it too
  return { DATABASE_URL: `${base}${base.includes('?') ? '&' : '?'}options=${encodeURIComponent(`-c search_path=${schema}`)}` };
}

export async function startServer(extraEnv = {}) {
  Object.assign(extraEnv, await isolatedDbEnv());
  const restored = !!extraEnv.DATA_DIR, dir = extraEnv.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-')), port = 18000 + Math.floor(Math.random() * 1500), base = `http://127.0.0.1:${port}`;
  const proc = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, ...extraEnv }, cwd: ROOT });
  let out = ''; proc.stdout.on('data', d => { out += d; }); proc.stderr.on('data', () => {});
  let hostPw;
  for (let i = 0; i < 60; i++) { await sleep(200); const m = out.match(/Temporary password: (\S+)/); if (restored && out.includes('listening')) { hostPw = 'restored'; break; } if (m && out.includes('listening')) { hostPw = m[1]; break; } }
  if (!hostPw) { proc.kill(); throw new Error('server did not start: ' + out); }
  return { dir, port, base, hostPw, env: extraEnv, logDir: path.join(dir, 'logs'), proc, stop: () => { proc.kill(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); } };   // the server may still be writing a log line as it exits
}

// Stop a server but keep its data folder, then start a new one on the same folder (a restart, as after an update). The Host password stays whatever the test set.
export async function restartServer(srv, extraEnv = {}) {
  const gone = new Promise(r => srv.proc.once('exit', r)); srv.proc.kill(); await gone;
  return startServer({ ...srv.env, ...extraEnv, DATA_DIR: srv.dir });
}

export class Client {
  constructor(base) { this.base = base; this.jar = {}; this.csrf = ''; this.headers = {}; }
  async req(method, url, body, { csrf = true } = {}) {
    if (url === '/api/app/signup' && body && !('acceptTerms' in body)) body = { ...body, acceptTerms: true };   // sign-up needs the Terms box ticked; tests of the refusal pass acceptTerms: false
    const res = await fetch(this.base + url, { method, headers: { ...this.headers, 'Content-Type': 'application/json', Cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(csrf && this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'), i = kv.indexOf('='), v = kv.slice(i + 1); if (/Max-Age=0/.test(c)) delete this.jar[kv.slice(0, i)]; else this.jar[kv.slice(0, i)] = v; }
    let data = {}; try { data = await res.json(); } catch {}
    if (data.csrf) this.csrf = data.csrf;
    return { status: res.status, data };
  }
}

// Read every file under the log dir into one string (for "does X appear / not appear in any log" checks).
export function allLogText(logDir) {
  let out = '';
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : (out += fs.readFileSync(p, 'utf8')); } };
  walk(logDir); return out;
}
export const readJsonl = (logDir, area) => fs.readFileSync(path.join(logDir, area, `${area}.jsonl`), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
export const readHuman = (logDir, area) => fs.readFileSync(path.join(logDir, area, `${area}.log`), 'utf8').trim().split('\n').filter(Boolean);

// The sign-in form has two boxes (Reseller ID, username): fill both from a "username@reseller-id" sign-in name.
export async function fillLogin(page, login) { const i = String(login).lastIndexOf('@'); await page.fill('#r', String(login).slice(i + 1)); await page.fill('#l', String(login).slice(0, i)); }
