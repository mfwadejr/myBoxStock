// TEST / e2e-host-filetest — a real browser: Host "Test a backup file" at phone and laptop width (upload with progress, report, tables, tap sizes,
// no sideways scrolling, Restore disabled until a pass and the typed word, picking a file already in the backup folder).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : (process.env.DB_CLIENT || 'sqlite') !== 'sqlite' ? 'SQLite only' : false;
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase', SHOTS = process.env.SHOT_DIR || '';
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: Test a backup file works at ${w}px (${label})`, { skip, timeout: 200000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(30000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401|status of 4\d\d/.test(m.text())) errors.push(m.text()); });
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      for (let i = 0; i < 3; i++) await new Client(srv.base).req('POST', '/api/app/signup', { businessName: `Shot Boxes ${i}`, email: `s${i}@example.com`, username: `sue${i}`, password: PW });
      await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
      const made = (await c.req('POST', '/api/host/backups/bundle', { passphrase: PASS })).data.name, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-ft-')), laptop = path.join(tmp, 'from-my-laptop.mbsbak');
      fs.copyFileSync(path.join(srv.dir, 'backup', made), laptop); fs.copyFileSync(laptop, path.join(srv.dir, 'backup', 'placed-by-hand.mbsbak'));
      await page.goto(srv.base + '/host/'); await page.waitForSelector('input'); const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');
      await page.goto(srv.base + '/host/#/backups'); await page.waitForSelector('#tabs'); await page.click('#tabs [data-t=full]');
      await page.waitForSelector('#ft-card'); assert.equal(await page.locator('#ft-file').isEnabled(), true, 'usable even though the tab is locked'); assert.equal(await page.locator('#ft-pick').isDisabled(), false);
      assert.match(await page.textContent('#ft-card'), /Up to 8\.0 GB|Up to 8 GB/); assert.ok(await overflow(page) <= 0, 'no sideways scrolling');
      if (w <= 640) assert.ok(await page.evaluate(() => [...document.querySelectorAll('#ft-card .btn, #ft-card .select-btn')].every(b => b.getBoundingClientRect().height >= 43.5)), '44px taps on the card');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `filetest-card-${w}.png`), fullPage: true });

      // upload a file from this computer
      await page.setInputFiles('#ft-file', laptop); await page.waitForSelector('.sheet #ft-run:not([disabled])');
      assert.match(await page.textContent('#ft-upt'), /Uploaded/); assert.equal(await page.locator('#ft-go').isHidden(), true, 'no restore button before a pass');
      const fs16 = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#ft-pp')).fontSize)); if (w <= 640) assert.ok(fs16 >= 16, 'inputs are 16px or more on a phone: ' + fs16);
      await page.fill('#ft-pp', 'the wrong passphrase'); await page.click('#ft-run'); await page.waitForSelector('#ft-sum');
      assert.match(await page.textContent('#ft-sum'), /did not pass/); assert.equal(await page.locator('#ft-go').isHidden(), true);
      await page.fill('#ft-pp', PASS); await page.click('#ft-run'); await page.waitForFunction(() => /passed every check/.test(document.querySelector('#ft-sum')?.textContent || ''));
      const t = await page.textContent('.sheet');
      for (const re of [/Full-site backup/, /Readable by this server/, /Accounts by plan/, /Trial 3/i, /Accounts by status/, /Active 3/i, /Users by role/, /Every account in the file/, /Host cannot open reseller records/]) assert.match(t, re);
      assert.equal(await page.locator('#ft-accts tbody tr').count(), 3, 'a row per account'); assert.ok(await page.locator('#ft-accts .chip.green').count() >= 3);
      await page.fill('#ft-q', 'zzzz'); assert.match(await page.textContent('#ft-accts'), /No account matches/); await page.fill('#ft-q', '');
      assert.ok(await overflow(page) <= 0, 'the report does not scroll the page sideways');
      assert.ok(await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth + 1; }), 'the sheet does not scroll sideways');
      if (w <= 640) assert.ok(await page.evaluate(() => [...document.querySelectorAll('.sheet .btn')].filter(b => b.offsetParent).every(b => b.getBoundingClientRect().height >= 43.5 || b.classList.contains('small'))), '44px taps in the sheet');
      // restore: shown after the pass, disabled until RESTORE is typed
      await page.locator('#ft-go').scrollIntoViewIfNeeded(); assert.equal(await page.locator('#ft-go').isVisible(), true); assert.equal(await page.locator('#ft-go').isDisabled(), true); assert.match(await page.textContent('#ft-why'), /Type RESTORE/);
      await page.fill('#ft-cf', 'restore'); assert.equal(await page.locator('#ft-go').isDisabled(), true); await page.fill('#ft-cf', 'RESTORE'); assert.equal(await page.locator('#ft-go').isDisabled(), false);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `filetest-report-${w}.png`) });
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });
      await new Promise(r => setTimeout(r, 400)); assert.equal(fs.existsSync(path.join(srv.dir, 'backup-incoming')) ? fs.readdirSync(path.join(srv.dir, 'backup-incoming')).length : 0, 0, 'closing the sheet removed the uploaded file');

      // a file already in the backup folder: no upload
      await page.click('#ft-card .select-btn'); await page.click('#ft-card .select-option[data-value="placed-by-hand.mbsbak"]'); await page.click('#ft-test-folder'); await page.waitForSelector('.sheet #ft-run:not([disabled])');
      assert.equal(await page.locator('#ft-up').isHidden(), true, 'no upload bar for a file already on the server');
      await page.fill('#ft-pp', PASS); await page.click('#ft-run'); await page.waitForFunction(() => /passed every check/.test(document.querySelector('#ft-sum')?.textContent || ''));
      await page.click('.sheet [data-cancel]');
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); }
  });
}
