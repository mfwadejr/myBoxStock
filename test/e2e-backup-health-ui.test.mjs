// TEST / e2e-backup-health-ui — the Backups card on the Host Overview and a backup alert, in a real browser at phone and laptop width.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', DAY = 86400e3, SHOTS = process.env.SHOT_DIR || '';
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: the Overview Backups card and a backup alert lay out cleanly at ${w}px (${label})`, { skip, timeout: 120000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(30000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401|status of 400/.test(m.text())) errors.push(m.text()); });
    const put = (k, v) => { const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); try { d.prepare('INSERT INTO settings (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at').run(k, JSON.stringify(v), Date.now()); } finally { d.close(); } };
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
      put('backup_status', { frequent: { lastOk: { at: Date.now() - 3600e3, name: 'x.db', size: 5000 } }, offsite: {}, last: null });
      put('backup_full', { enabled: true, frequency: 'nightly' }); put('backup_full_status', { lastOk: { name: 'f.mbsbak', at: Date.now() - 4 * DAY, size: 9000, verified: true, destinations: [] }, lastFail: null });
      put('backup_destinations', [{ id: 'd1', type: 'folder', name: 'NAS copy', enabled: true, settings: { path: '/tmp/none' }, secrets: {}, hostKey: '', lastTest: { at: Date.now(), ok: false } }]);
      await c.req('POST', '/api/host/alerts/check');
      await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
      const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('#bk-health');

      const t = await page.textContent('#bk-health-a'); assert.match(t, /Last snapshot/); assert.match(t, /Last full-site backup/); assert.match(t, /Last test restore/); assert.match(t, /Never/); assert.match(t, /Copy off this server/);
      assert.match(await page.textContent('#bk-health-b'), /Backup space left/); assert.match(await page.textContent('#bk-health'), /2 need attention|3 need attention/);
      assert.match(await page.textContent('#bk-health-dests'), /NAS copy/); assert.match(await page.textContent('#bk-health-dests'), /Failing/);
      assert.ok(await overflow(page) <= 0, 'no sideways scrolling');
      // cards never touch: every card on the page has at least 8px above the one before it
      const gaps = await page.evaluate(() => { const cs = [...document.querySelectorAll('.main .card')].map(e => e.getBoundingClientRect()); const out = []; for (const a of cs) for (const b of cs) if (a !== b && b.top >= a.bottom - 0.5 && b.top - a.bottom < 8 && b.left < a.right && b.right > a.left) out.push([a.bottom, b.top]); return out; });
      assert.deepEqual(gaps, [], 'cards have a gap between them');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `overview-backups-${w}.png`), fullPage: true });

      await page.goto(srv.base + '/host/#/alerts'); await page.waitForSelector('.log-line');
      const a = await page.textContent('.main'); assert.match(a, /No recent full-site backup/); assert.match(a, /A backup destination is failing/);
      assert.equal(await page.locator('.log-message a[href="#/backups"]').first().count(), 1); assert.ok(await overflow(page) <= 0);
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); }
  });
}
