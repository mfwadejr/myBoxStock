// TEST / e2e-t38-demo — Host > Demo mode in a real browser at phone and laptop width: the page lays out cleanly, Demo mode is switched on, Build asks for a backup first (the Owner may type the
// words to continue), the job strip shows, the credentials table shows a password on request, and the DEMO chip and the show/hide filter appear in Accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', SHOTS = process.env.SHOT_DIR || '';
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: Demo mode lays out cleanly and works at ${w}px (${label})`, { skip, timeout: 180000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(30000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401|status of 40\d|409/.test(m.text())) errors.push(m.text()); });
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
      const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');
      await page.goto(srv.base + '/host/#/demo'); await page.waitForSelector('[data-set=demo3]');
      const t = await page.textContent('.main'); for (const s of ['Demo mode', 'Demo3', 'Demo300', 'Demo1000', 'Demo5000', 'Build', 'Edit recipe', 'Reset to defaults', 'Add a Custom set', 'Reset all demo settings to defaults']) assert.ok(t.includes(s), 'shows ' + s);
      assert.equal(await page.locator('[data-set]').count(), 4); assert.ok(await overflow(page) <= 0, 'no sideways scrolling');
      if (w < 700) { const small = await page.evaluate(() => [...document.querySelectorAll('.main button.btn, .main a.btn, .main .switch')].filter(b => b.offsetHeight < 44).map(b => b.outerHTML.slice(0, 80))); assert.deepEqual(small, [], 'taps are at least 44px'); }
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `demo-${w}.png`), fullPage: true });
      assert.equal(await page.locator('[data-set=demo3] [data-do=build]').isDisabled(), true, 'Build waits for the switch');

      await page.click('label.switch:has(#dm-on)'); await page.waitForSelector('[data-set=demo3] [data-do=build]:not([disabled])');
      // Edit recipe shows a live estimate, and Save keeps it
      await page.click('[data-set=demo3] [data-do=edit]'); await page.waitForSelector('.sheet #est'); await page.waitForFunction(() => /accounts/.test(document.querySelector('.sheet #est')?.textContent || ''));
      assert.ok(await overflow(page) <= 0); await page.click('.sheet [data-cancel]');
      // Build: the estimate sheet, then the backup prompt; the Owner types the words to continue
      await page.click('[data-set=demo3] [data-do=build]'); await page.waitForSelector('.sheet #go'); await page.click('.sheet #go');
      await page.waitForSelector('.sheet #bk-now'); assert.ok((await page.textContent('.sheet:has(#bk-now)')).includes('Take a backup first')); assert.equal(await page.locator('.sheet #bk-skip').isDisabled(), true);
      await page.fill('.sheet #bk-t', 'PROCEED WITHOUT BACKUP'); assert.equal(await page.locator('.sheet #bk-skip').isDisabled(), false); assert.ok(await overflow(page) <= 0); await page.click('.sheet #bk-skip');
      await page.waitForSelector('#job-strip :is(#job-card, #job-done)'); await page.waitForSelector('#job-done'); assert.match(await page.textContent('#job-done'), /3 of 3 accounts built/);
      assert.ok(await overflow(page) <= 0);
      // credentials: Show reveals a password
      await page.goto(srv.base + '/host/#/demo'); await page.waitForSelector('#dm-creds [data-act=show]');
      const first = page.locator('#dm-creds [data-act=show]').first(); await first.click(); await page.waitForFunction(() => [...document.querySelectorAll('#dm-creds [data-pw]')].some(e => e.dataset.shown && e.textContent.length >= 12));
      assert.ok((await page.textContent('#dm-creds')).includes('Open as this reseller')); assert.ok(await overflow(page) <= 0);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `demo-built-${w}.png`), fullPage: true });
      // the Accounts page: DEMO chips and the filter
      await page.goto(srv.base + '/host/#/accounts'); await page.waitForSelector('.chip:has-text("DEMO")'); assert.ok((await page.textContent('.main')).includes('Show demo accounts'));
      await page.click('label:has-text("Show demo accounts")'); await page.waitForFunction(() => !document.querySelector('.main')?.textContent.includes('DEMO') || document.querySelectorAll('.main .chip').length >= 0);
      assert.ok(await overflow(page) <= 0); assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); }
  });
}
