#!/usr/bin/env node
// TOOLS / measure-speed — T49, measure first. Builds a Demo mode set into a throwaway data folder, starts the real server on it, then drives headless Chromium as the Owner of the LARGEST demo
// account and times what a reseller feels: sign-in to a usable Home (every record downloaded and decrypted), browser memory, opening Inventory / Sales / Customers and searching each,
// Quick sale scan-to-add, and the size and time of a reseller backup download. Three profiles: laptop, recent phone (4x CPU slowdown, 390px) and older phone (6x, 375px).
// It changes nothing in the app and only deletes the temp folder it made.
//
//   node tools/measure-speed.mjs --set demo300 [--profiles laptop,recent,older] [--json out.json] [--keep]
//   --set demo3 | demo300 | demo1000 | demo5000    (the bigger ones need disk and minutes; the script checks free disk first)
//
// Notes on honesty: the network is localhost (no download delay is simulated; the bytes are reported so a real link can be estimated); CPU slowdown is Chromium's throttle, a rough stand-in for a phone;
// Demo accounts use 100,000 key-derivation rounds where real accounts use 600,000, so the script also times 600,000 rounds separately (the "real sign-in key cost" row).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROFILES = {
  laptop: { label: 'Laptop', width: 1280, height: 800, cpu: 1, mobile: false },
  recent: { label: 'Recent phone (4x CPU, 390px)', width: 390, height: 844, cpu: 4, mobile: true },
  older: { label: 'Older phone (6x CPU, 375px)', width: 375, height: 667, cpu: 6, mobile: true },
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const round = (n, d = 0) => n == null ? null : Math.round(n * 10 ** d) / 10 ** d;

// ---- build ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Builds `setKey` into `dir` and returns what the browser run needs. DATA_DIR must be set before the app modules load, so this is called once per process.
export async function buildDemo(setKey, dir) {
  process.env.DATA_DIR = dir;
  const free = fs.statfsSync(dir); const freeMB = Math.floor(free.bavail * free.bsize / 1048576);
  const { initDb } = await import(path.join(ROOT, 'src/db/connection.mjs'));
  const demo = await import(path.join(ROOT, 'src/services/demo/index.mjs'));
  const db = await initDb({ file: path.join(dir, 'myboxstock.db') });
  await demo.setEnabled(db, true);   // demo logins only work while Demo mode is on
  const section = await demo.getDemo(db), set = section.sets.find(s => s.key === setKey);
  if (!set) throw new Error('unknown set ' + setKey);
  const est = demo.estimate(set);
  const needMB = Math.round(est.bytes / 1048576 * 2); if (needMB > freeMB) throw new Error(`not enough free disk: need about ${needMB} MB, have ${freeMB} MB`);
  const t0 = Date.now(), out = await demo.buildSet(db, setKey, { requireOn: false, anchor: Date.now() }), buildMs = Date.now() - t0;
  // the largest account by stored records, its Owner and that Owner's password
  const big = await db.get(`SELECT a.id, a.account_code, a.business_name, COUNT(r.id) n FROM accounts a JOIN records r ON r.account_id = a.id WHERE a.demo = 1 AND a.demo_set = ? GROUP BY a.id, a.account_code, a.business_name ORDER BY n DESC LIMIT 1`, [setKey]);
  const owner = await db.get(`SELECT u.id, u.login FROM account_users u WHERE u.account_id = ? AND u.role = 'Administrator' ORDER BY u.created_at, u.login LIMIT 1`, [big.id]);
  const named = await db.get('SELECT user_id, kind FROM demo_logins WHERE user_id = ?', [owner.id]);
  const pwRow = named || await db.get(`SELECT user_id FROM demo_logins WHERE set_key = ? AND kind = 'filler'`, [setKey]);
  const password = (await demo.passwordOf(db, pwRow.user_id)).password;
  const counts = {};
  for (const r of await db.all('SELECT type, COUNT(*) n FROM records WHERE account_id = ? GROUP BY type', [big.id])) counts[r.type] = Number(r.n);
  const blob = await db.get('SELECT COALESCE(SUM(LENGTH(blob)), 0) b FROM records WHERE account_id = ?', [big.id]);
  const sizes = await db.all('SELECT account_id, type, COUNT(*) n FROM records WHERE account_id IN (SELECT id FROM accounts WHERE demo = 1 AND demo_set = ?) GROUP BY account_id, type', [setKey]);
  const per = {}; for (const r of sizes) (per[r.account_id] ||= { item: 0, customer: 0, sale: 0 })[r.type] = Number(r.n);
  const devs = Object.values(per).map(p => p.item).sort((a, b) => a - b);
  const set$ = { accounts: out.accounts ?? Object.keys(per).length, devicesMedian: devs[Math.floor(devs.length / 2)] || 0, devicesMax: devs[devs.length - 1] || 0, totalRecords: sizes.reduce((s, r) => s + Number(r.n), 0) };
  await db.close?.();
  return { setKey, buildMs, freeMB, set: set$, account: { code: big.account_code, name: big.business_name, login: owner.login, password, records: Number(big.n), devices: counts.item || 0, customers: counts.customer || 0, sales: counts.sale || 0, models: counts.model || 0, blobBytes: Number(blob.b), counts } };
}

// ---- server -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export async function startServerOn(dir) {
  const port = 19000 + Math.floor(Math.random() * 900), base = `http://127.0.0.1:${port}`;
  const proc = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir }, cwd: ROOT });
  let out = ''; proc.stdout.on('data', d => { out += d; }); proc.stderr.on('data', d => { out += d; });
  for (let i = 0; i < 100; i++) { await sleep(200); if (out.includes('listening')) return { base, proc, stop: () => proc.kill() }; if (proc.exitCode != null) break; }
  proc.kill(); throw new Error('server did not start: ' + out.slice(0, 500));
}

// ---- browser ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function loadPlaywright() {
  for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright/index.mjs']) { try { const m = await import(p); return m.chromium || m.default.chromium; } catch {} }
  throw new Error('playwright is not available');
}
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

// Runs inside the page: do `action`, then watch the page until `ready` is true, let it go quiet, and return the milliseconds to ready (after two animation frames) and to the last change.
const INJECT = `window.__timed = (action, ready, quiet = 120, limit = 120000) => new Promise((resolve) => {
  const t0 = performance.now(); let tReady = null, last = t0, done = false, timer = null;
  const finish = (why) => { if (done) return; done = true; obs.disconnect(); clearTimeout(timer); clearTimeout(cap); resolve({ ready: tReady == null ? null : tReady - t0, settled: last - t0, why }); };
  const check = () => { if (tReady == null && ready()) { tReady = -1; requestAnimationFrame(() => requestAnimationFrame(() => { tReady = performance.now(); last = tReady; })); } };
  const bump = () => { last = performance.now(); check(); clearTimeout(timer); if (tReady != null) timer = setTimeout(() => finish('quiet'), quiet); };
  const obs = new MutationObserver(bump); obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  const cap = setTimeout(() => finish('limit'), limit);
  action(); check(); if (tReady != null) timer = setTimeout(() => finish('quiet'), quiet + 100);
});`;

export async function measureProfile({ base, account, profileKey, steps = ['signin', 'pages', 'sell', 'backup'], log = () => {} }) {
  const P = PROFILES[profileKey], chromium = await loadPlaywright();
  const br = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: P.width, height: P.height }, isMobile: P.mobile, hasTouch: P.mobile, deviceScaleFactor: P.mobile ? 2 : 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  const cdp = await ctx.newCDPSession(page), res = { profile: P.label, cpu: P.cpu, width: P.width };
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let rec = null; page.on('requestfinished', async (rq) => { if (/\/api\/app\/vault\/records$/.test(rq.url())) { try { const r = await rq.response(), t = rq.timing(); rec = { ms: t.responseEnd - t.requestStart, ttfbMs: t.responseStart - t.requestStart, bytes: (await r.body()).length }; } catch {} } });
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); const m = await cdp.send('Performance.getMetrics'); const g = (n) => m.metrics.find(x => x.name === n)?.value || 0; return { usedMB: round(g('JSHeapUsedSize') / 1048576, 1), totalMB: round(g('JSHeapTotalSize') / 1048576, 1), domNodes: g('Nodes') }; };
  const timed = (action, ready, quiet) => page.evaluate(([a, r, q]) => window.__timed(new Function(a), new Function('return (' + r + ')'), q), [action, ready, quiet]);
  try {
    await page.addInitScript(INJECT);
    await cdp.send('Performance.enable'); if (P.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });

    // sign in
    await page.goto(base + '/app/'); await page.waitForSelector('#p');
    // the key cost a real sign-in pays (600,000 rounds), timed where the demo's 100,000 would understate it
    res.pbkdf2_600k_ms = round(await page.evaluate(async () => { const t = performance.now(); const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('x'), 'PBKDF2', false, ['deriveBits']); await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(16), iterations: 600000 }, k, 256); return performance.now() - t; }));

    const at = account.login.lastIndexOf('@'); await page.fill('#r', account.login.slice(at + 1)); await page.fill('#l', account.login.slice(0, at)); await page.fill('#p', account.password);
    const tClick = Date.now(); await page.click('button.block');
    await page.waitForSelector('.side, .tabbar, .stat-grid', { state: 'attached' }); const shellMs = Date.now() - tClick;
    await page.waitForSelector('.stat-grid'); const homeMs = Date.now() - tClick;
    await page.waitForFunction(() => window.AccountApp?.store?.all('item').length >= 0); await sleep(500);
    res.signin = { toShellMs: shellMs, toUsableHomeMs: homeMs, recordsDownload: rec ? { ms: round(rec.ms), ttfbMs: round(rec.ttfbMs), bytes: rec.bytes } : null, afterDownloadMs: rec ? round(homeMs - rec.ms) : null };
    res.loaded = await page.evaluate(() => { const S = AccountApp.store; return { devices: S.all('item').length, customers: S.all('customer').length, sales: S.all('sale').length, unreadable: S.unreadable }; });
    res.heap = await heap();
    // split of the sign-in cost: a full download + decrypt of every record again (store emptied first), and a load where nothing changed (the cheap path a changes-only cache would take)
    res.reload = await page.evaluate(async () => { const S = AccountApp.store, types = Object.keys(S.data); let t = performance.now(); const unchanged0 = await (async () => { await S.load(); return performance.now() - t; })(); const saved = types.map(k => [k, new Map(S.data[k])]); types.forEach(k => S.data[k].clear()); t = performance.now(); await S.load(); const full = performance.now() - t; return { unchangedLoadMs: Math.round(unchanged0), fullDownloadAndDecryptMs: Math.round(full) }; });
    if (!steps.includes('signin') && steps.length === 0) return res;

    const go = async (hash, readyJs) => { await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForSelector('.stat-grid'); await sleep(300); return timed(`location.hash = '${hash}'`, readyJs, 150); };
    if (steps.includes('pages')) {
      res.pages = {};
      const pick = await page.evaluate(() => { const S = AccountApp.store, mid = (a) => a[Math.floor(a.length / 2)]; const it = mid(S.all('item')), sl = mid(S.all('sale')), cu = mid(S.all('customer')); return { uid: String(it?.data.uid || it?.data.serial || '').slice(0, 8), sale: String(sl?.data.no || ''), cust: String(cu?.data.name || '') }; });
      const defs = [
        ['inventory', '#/inventory', "!!document.querySelector('#st') && document.querySelectorAll('tbody tr, .card-row, .row').length > 0", pick.uid],
        ['sales', '#/sales', "!!document.querySelector('#sdl') && document.querySelectorAll('tbody tr, .card-row, .row').length > 0", pick.sale],
        ['customers', '#/customers', "!!document.querySelector('#q') && !document.querySelector('#st') && !document.querySelector('#sdl') && document.querySelectorAll('tbody tr, .card-row, .row').length > 0", pick.cust],
      ];
      for (const [name, hash, ready, term] of defs) {
        const open = [], search = [];
        for (let i = 0; i < 3; i++) open.push((await go(hash, ready)).ready);
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => { const q = document.querySelector('#q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(1500);
          const r = await timed(`const q = document.querySelector('#q'); q.value = ${JSON.stringify(term)}; q.dispatchEvent(new Event('input', { bubbles: true }));`, 'true', 250);
          search.push(r.settled);
        }
        res.pages[name] = { openMs: round(median(open)), openAllMs: open.map(round), searchMs: round(median(search)), searchAllMs: search.map(round), searchTerm: term.length > 3 ? '(a real value from the account)' : term, domNodes: (await heap()).domNodes };
      }
    }
    if (steps.includes('sell')) {
      await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForSelector('.stat-grid'); await sleep(300);
      await timed("location.hash = '#/sell'", "!!document.querySelector('#scan')", 150);
      const uids = await page.evaluate(() => AccountApp.store.all('item').filter(i => i.data.status === 'available').slice(0, 3).map(i => i.data.uid || i.data.serial));
      const adds = [];
      for (let i = 0; i < uids.length; i++) {
        const r = await timed(`const s = document.querySelector('#scan'); s.value = ${JSON.stringify(uids[i])}; s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));`, `document.querySelectorAll('.cart-line').length >= ${i + 1}`, 150, 20000);
        adds.push(r.ready == null ? null : round(r.ready));
      }
      res.quickSale = { available: uids.length, scanToAddMs: adds };
    }
    if (steps.includes('backup')) {
      await page.evaluate(() => { location.hash = '#/backup'; }); await page.waitForSelector('#mk'); await sleep(300);
      const t = Date.now(); const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 600000 }), page.click('#mk')]); const p = await dl.path(); const ms = Date.now() - t;
      res.backup = { ms, bytes: fs.statSync(p).size, name: dl.suggestedFilename() }; fs.rmSync(p, { force: true });
    }
    res.heapEnd = await heap(); res.pageErrors = errors.slice(0, 5);
    return res;
  } finally { await br.close().catch(() => {}); }
}

// ---- main -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export async function run({ set = 'demo3', profiles = ['laptop'], steps, keep = false, log = console.error } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-speed-')); let srv;
  try {
    log(`building ${set} in ${dir} ...`); const b = await buildDemo(set, dir); log(`built in ${Math.round(b.buildMs / 1000)}s; largest account ${b.account.code}: ${b.account.devices} devices, ${b.account.customers} customers, ${b.account.sales} sales`);
    srv = await startServerOn(dir);
    const results = {};
    for (const k of profiles) { log(`measuring ${k} ...`); results[k] = await measureProfile({ base: srv.base, account: b.account, profileKey: k, steps }); }
    const { password, ...account } = b.account;
    return { set, built: { ms: b.buildMs, ...b.set }, account, results, when: new Date().toISOString(), node: process.version };
  } finally { srv?.stop(); if (!keep) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
  const out = await run({ set: arg('set', 'demo300'), profiles: arg('profiles', 'laptop,recent,older').split(','), keep: process.argv.includes('--keep') });
  const json = JSON.stringify(out, null, 2); if (arg('json')) fs.writeFileSync(arg('json'), json); else console.log(json);
  process.exit(0);
}
