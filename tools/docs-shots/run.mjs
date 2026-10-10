#!/usr/bin/env node
// TOOLS / docs-shots / run — re-shoots the documentation (and marketing-site) screenshots from Demo mode data. Made-up data only.
//   node tools/docs-shots/run.mjs [--manifest reseller|host|site|all] [--only NAME[,NAME]] [--set demo3] [--out DIR] [--keep]
// Builds the Demo set into a throw-away data folder, starts the real server on it, signs in as a demo login (the Owner by default, or the entry's role) for reseller
// shots, or as the Host admin for host shots, and saves NAME-laptop.png (1280x800) and NAME-phone.png (390x844) into --out (default public/assets/docs).
// Passwords stay in memory: they are never printed, typed into a visible field or saved, and a shot is refused if one is visible on the page.
// See tools/docs-shots/README.md for the manifest format.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
export const SIZES = { laptop: { width: 1280, height: 800, scale: 1, mobile: false }, phone: { width: 390, height: 844, scale: 2, mobile: true } };
export const LIMIT = 240 * 1024;   // the documentation test allows 250 KB; stay a little under
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };

// ---- compression: palette PNG, fewer colours (then a smaller picture) until the file is under the limit ----------------------------------------------------------------------
async function loadSharp() { for (const p of ['sharp', '/opt/npm-tools/node_modules/sharp/lib/index.js']) { try { return (await import(p)).default; } catch {} } return null; }
export async function compress(buf, limit = LIMIT) {
  const sharp = await loadSharp();
  if (!sharp) { if (buf.length > limit) throw new Error('sharp is not installed, so the screenshot cannot be compressed'); return { buf, colors: 0, scale: 1 }; }
  const meta = await sharp(buf).metadata();
  for (const scale of [1, 0.85, 0.7]) for (const colors of [256, 128, 64, 32]) {
    let img = sharp(buf); if (scale < 1) img = img.resize(Math.round(meta.width * scale));
    const out = await img.png({ palette: true, colors, effort: 10, compressionLevel: 9, dither: 0.5 }).toBuffer();
    if (out.length <= limit) return { buf: out, colors, scale };
  }
  throw new Error(`could not get under ${Math.round(limit / 1024)} KB`);
}

// ---- Demo data and server -------------------------------------------------------------------------------------------------------------------------------------------------------
async function buildDemo(setKey, dir) {
  process.env.DATA_DIR = dir;
  const { initDb } = await import(pathToFileURL(path.join(ROOT, 'src/db/connection.mjs')));
  const demo = await import(pathToFileURL(path.join(ROOT, 'src/services/demo/index.mjs')));
  const db = await initDb({ file: path.join(dir, 'myboxstock.db') });
  await demo.setEnabled(db, true);   // demo logins only work while Demo mode is on
  await demo.buildSet(db, setKey, { requireOn: false, anchor: Date.now() });
  const rows = (await demo.credentialRows(db)).find(r => r.key === setKey)?.logins.filter(l => l.id) || [], logins = {};
  for (const l of rows) { const { password } = await demo.passwordOf(db, l.id); logins[{ owner: 'Owner', std: 'Standard', view: 'View' }[l.kind] || l.kind] = { login: l.login, password }; }
  await db.close?.();
  if (!logins.Owner) throw new Error('the Demo set has no Owner login');
  return logins;
}
async function startServer(dir) {
  const port = 19000 + Math.floor(Math.random() * 900), base = `http://127.0.0.1:${port}`;
  const proc = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir }, cwd: ROOT });
  let out = ''; proc.stdout.on('data', d => { out += d; }); proc.stderr.on('data', d => { out += d; });
  for (let i = 0; i < 100; i++) { await sleep(200); const m = out.match(/Temporary password: (\S+)/); if (out.includes('listening')) return { base, proc, hostPw: m?.[1] || '', stop: () => proc.kill() }; if (proc.exitCode != null) break; }
  proc.kill(); throw new Error('the server did not start: ' + out.slice(0, 300));
}
async function api(base, jar, method, url, body) {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar.c).map(([k, v]) => `${k}=${v}`).join('; '), ...(jar.csrf ? { 'X-CSRF-Token': jar.csrf } : {}) }, body: body ? JSON.stringify(body) : undefined });
  for (const sc of r.headers.getSetCookie?.() || []) { const [kv] = sc.split(';'), i = kv.indexOf('='); jar.c[kv.slice(0, i)] = kv.slice(i + 1); }
  const j = await r.json().catch(() => ({})); if (j.csrf) jar.csrf = j.csrf; return { status: r.status, data: j };
}
// The Host admin starts with a temporary password; set a throw-away one through the API and switch the request limiter off (this server is disposable).
async function prepareHost(srv) {
  const jar = { c: {}, csrf: '' }, pw = 'Shots-' + Math.random().toString(36).slice(2) + 'Aa1!';
  const l = await api(srv.base, jar, 'POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); if (l.status !== 200) throw new Error('Host admin sign-in failed');
  jar.csrf = l.data.csrf || '';
  await api(srv.base, jar, 'POST', '/api/host/change-password', { current: srv.hostPw, next: pw });
  await api(srv.base, jar, 'PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
  return { login: 'admin', password: pw };
}

// ---- browser -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function launch() {
  let chromium; for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright/index.mjs']) { try { const m = await import(p); chromium = m.chromium || m.default.chromium; break; } catch {} }
  if (!chromium) throw new Error('playwright is not available');
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  return chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
}

export async function run({ manifests, only = [], setKey = 'demo3', out, keep = false, log = console.error } = {}) {
  const entries = []; for (const m of manifests) { const mod = await import(pathToFileURL(path.join(HERE, `manifest-${m}.mjs`))); for (const e of mod.default) entries.push({ viewport: 'both', ...e, manifest: m }); }
  const chosen = only.length ? entries.filter(e => only.includes(e.name)) : entries;
  if (!chosen.length) { log('nothing to shoot'); return []; }
  const seen = new Set(); for (const e of chosen) { if (!/^[a-z0-9][a-z0-9-]*$/.test(e.name || '')) throw new Error(`bad shot name "${e.name}"`); if (seen.has(e.name)) throw new Error(`duplicate shot name "${e.name}"`); seen.add(e.name); if (!['reseller', 'host'].includes(e.set)) throw new Error(`${e.name}: set must be reseller or host`); }
  fs.mkdirSync(out, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-shots-')); let srv, br; const table = [];
  try {
    log(`building ${setKey} ...`); const logins = await buildDemo(setKey, dir); srv = await startServer(dir);
    const secrets = Object.values(logins).map(l => l.password); const host = chosen.some(e => e.set === 'host') ? await prepareHost(srv) : null; if (host) secrets.push(host.password);
    br = await launch(); const ctxs = new Map();
    const identity = (e) => e.set === 'host' ? 'host' : (e.role || 'Owner');
    const session = async (id, size) => {
      const key = `${id}/${size}`; if (ctxs.has(key)) return ctxs.get(key);
      const S = SIZES[size], ctx = await br.newContext({ viewport: { width: S.width, height: S.height }, deviceScaleFactor: S.scale, isMobile: S.mobile, hasTouch: S.mobile, acceptDownloads: true }), page = await ctx.newPage(); page.setDefaultTimeout(30000);
      if (id === 'host') {
        await page.goto(srv.base + '/host/'); await page.waitForSelector('#u'); await page.fill('#u', host.login); await page.fill('#p', host.password); await page.click('#go'); await page.waitForSelector('.main');
      } else {
        const L = logins[id]; if (!L) throw new Error(`the Demo set has no ${id} login`);
        await page.goto(srv.base + '/app/'); await page.waitForSelector('#p'); const at = L.login.lastIndexOf('@');
        await page.fill('#r', L.login.slice(at + 1)); await page.fill('#l', L.login.slice(0, at)); await page.fill('#p', L.password); await page.click('button.block'); await page.waitForSelector('.main');
      }
      await page.waitForTimeout(800); const s = { ctx, page }; ctxs.set(key, s); return s;
    };
    // One size at a time: a second sign-in of the same login (the phone) would end the first one's session, so each size's pages are closed before the next size starts.
    const rows = new Map(chosen.map(e => [e.name, { name: e.name, set: e.set, role: e.role || (e.set === 'host' ? 'Host admin' : 'Owner'), route: e.route }]));
    for (const size of ['laptop', 'phone']) {
      for (const e of chosen.filter(x => x.viewport === 'both' || !x.viewport || x.viewport === size)) {
        const row = rows.get(e.name);
        const { page } = await session(identity(e), size);
        const helpers = { size, base: srv.base, wait: (ms) => page.waitForTimeout(ms), waitFor: (sel) => page.waitForSelector(sel), click: (sel) => page.click(sel), fill: (sel, v) => page.fill(sel, v), scrollTo: (sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView(), sel) };
        await page.keyboard.press('Escape'); await page.evaluate(() => { document.querySelectorAll('.scrim').forEach(x => x.querySelector('[data-cancel], #done')?.click()); }); await page.waitForTimeout(250);   // close any sheet left open by the last shot
        await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForTimeout(300); await page.evaluate((h) => { location.hash = h; }, e.route);   // a hash change keeps the signed-in session (the key lives only in the page)
        await page.waitForFunction(() => (document.querySelector('.main')?.innerText || '').trim().length > 20, null, { timeout: 30000 }).catch(async (err) => { throw new Error(`${e.name} (${size}): the page did not show anything at ${e.route}; it is on ${await page.evaluate(() => location.hash + ' ' + document.body.innerText.slice(0, 200))}`); }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(600);
        if (e.prep) await e.prep(page, helpers);
        await page.evaluate((k) => { document.querySelector('.toasts')?.replaceChildren(); if (!k) window.scrollTo(0, 0); }, e.keepScroll); await page.waitForTimeout(200);
        const visible = await page.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('input,textarea')].map(i => i.value).join(' '));
        if (secrets.some(p => p && visible.includes(p))) throw new Error(`${e.name}: a password is visible on the page; refusing to take the shot`);
        const raw = await page.screenshot({ fullPage: !!e.fullPage }), c = await compress(raw);
        fs.writeFileSync(path.join(out, `${e.name}-${size}.png`), c.buf); row[size] = `${(c.buf.length / 1024).toFixed(0)} KB`;
        log(`  ${e.name} (${size}): ${row[size]}`);
      }
      for (const [k, v] of [...ctxs]) if (k.endsWith('/' + size)) { await v.ctx.close().catch(() => {}); ctxs.delete(k); }
    }
    table.push(...rows.values());
    return table;
  } finally { await br?.close().catch(() => {}); srv?.stop(); if (!keep) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const m = arg('manifest', 'all'), manifests = m === 'all' ? ['reseller', 'host'].filter(x => fs.existsSync(path.join(HERE, `manifest-${x}.mjs`))) : m.split(',');
  const out = path.resolve(ROOT, arg('out', 'public/assets/docs'));
  const table = await run({ manifests, only: (arg('only', '') || '').split(',').filter(Boolean), setKey: arg('set', 'demo3'), out, keep: process.argv.includes('--keep') });
  console.log('\nname'.padEnd(34) + 'set'.padEnd(10) + 'role'.padEnd(12) + 'route'.padEnd(22) + 'laptop'.padEnd(10) + 'phone');
  for (const r of table) console.log(r.name.padEnd(33) + ' ' + r.set.padEnd(9) + ' ' + r.role.padEnd(11) + ' ' + r.route.padEnd(21) + ' ' + (r.laptop || '-').padEnd(9) + ' ' + (r.phone || '-'));
  console.log(`\nwrote ${table.length} shot(s) to ${path.relative(ROOT, out) || '.'}`);
  process.exit(0);
}
