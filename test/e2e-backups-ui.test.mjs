// TEST / e2e-backups-ui — the Backups page in a real browser at phone and laptop width: status strip, five tabs, capped lists with Load more, restore and test-restore sheets, destinations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', SHOTS = process.env.SHOT_DIR || '';

async function signIn(page, srv) {
  await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
  const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(PW); await page.keyboard.press('Enter'); // the password was already changed through the API
  await page.waitForSelector('.main');
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: Backups page works at ${w}px (${label})`, { skip, timeout: 170000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401/.test(m.text())) errors.push(m.text()); }); // (a 401 is just the sign-in check before anyone is signed in)
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Shot Boxes', email: 's@example.com', username: 'sue', password: PW });
      await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
      await c.req('PUT', '/api/host/backups/full', { enabled: false, passphrase: 'a long backup passphrase', keepDaily: 14, keepWeekly: 8 });
      assert.equal((await c.req('POST', '/api/host/backups/run/frequent')).status, 200);
      const dir = path.join(srv.dir, 'backup'), base = Date.now() - 200 * 60000;
      for (let i = 0; i < 30; i++) fs.writeFileSync(path.join(dir, `myboxstock-snap-${new Date(base + i * 60000).toISOString().replace(/[:T]/g, '-').slice(0, 19)}.db`), 'x'.repeat(2048));
      fs.writeFileSync(path.join(dir, 'myboxstock-pre-restore-2026-01-02-03-04-05.db'), 'x');
      await signIn(page, srv);
      await page.goto(srv.base + '/host/#/backups'); await page.waitForSelector('#tabs'); await page.waitForSelector('.stat');

      // status strip
      const strip = await page.textContent('.main'); assert.match(strip, /Last backup/); assert.match(strip, /verified/); assert.match(strip, /Next run/); assert.match(strip, /Offsite copy/); assert.match(strip, /Space used/);
      assert.match(await page.textContent('#cost'), /At these settings you will hold about .* and upload about .* a day\./);
      assert.deepEqual(await page.locator('#tabs button').allTextContents(), ['Frequent snapshots', 'Offsite copies', 'Full-site backups', 'Safety copies', 'Destinations']);
      assert.ok(await overflow(page) <= 0, 'no sideways scrolling on the first tab');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `backups-frequent-${w}.png`), fullPage: true });

      // capped list, Showing N of M, Load more
      await page.waitForSelector('#list .feed');
      assert.match(await page.textContent('#list .more-row'), /Showing 25 of 3\d/); await page.click('#list [data-more]');
      await page.waitForFunction(() => /Showing 3\d of 3\d/.test(document.querySelector('#list .more-row').textContent)); assert.equal(await page.locator('#list [data-more]').count(), 0);
      const feed = await page.evaluate(() => { const f = document.querySelector('#list .feed'), cs = getComputedStyle(f); return { max: cs.maxHeight, over: cs.overflowY, h: f.getBoundingClientRect().height }; });
      if (w > 640) assert.ok(feed.max !== 'none' && feed.over === 'auto' && feed.h <= 700, `capped on a laptop: ${JSON.stringify(feed)}`); else assert.equal(feed.max, 'none', 'no cap on a phone');
      assert.ok(await page.locator('#list td.ident').count() >= 30, 'file names use the ident class'); assert.ok(await page.locator('#list td.tab-num').count() >= 30);
      if (w <= 640) { const d = await page.evaluate(() => getComputedStyle(document.querySelector('#list tbody tr')).display); assert.ok(['block', 'grid', 'flex'].includes(d), 'rows become cards on a phone: ' + d); }

      // tap targets on a phone
      if (w <= 640) { const small = await page.evaluate(() => [...document.querySelectorAll('#pane .btn, #tabs button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim())); assert.deepEqual(small, [], 'every button is at least 44px tall'); }

      // restore sheet
      await page.locator('#list [data-restore]').first().click(); await page.waitForSelector('.sheet');
      const sheet = await page.textContent('.sheet'); assert.match(sheet, /myboxstock-snap-/); assert.match(sheet, /\d{4}-\d\d-\d\d \d\d:\d\d UTC/); assert.match(sheet, /ago/); assert.match(sheet, /Anything entered after it was taken will be lost/); assert.match(sheet, /safety copy/); assert.match(sheet, /restarts/);
      assert.equal(await page.locator('.sheet #go').isDisabled(), true); await page.fill('.sheet #cf', 'RESTORE'); assert.equal(await page.locator('.sheet #go').isDisabled(), false);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `backups-restore-${w}.png`) });
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });

      // test restore of a real snapshot
      const real = page.locator('#list tr', { hasText: 'Snapshot' }).filter({ has: page.locator('[data-test]') });
      await page.locator('#list [data-test]').first().click(); await page.waitForSelector('.sheet #go'); await page.click('.sheet #go');
      await page.waitForSelector('.sheet .banner'); const t = await page.textContent('.sheet'); assert.match(t, /did not pass|passed/); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `backups-testrestore-${w}.png`) });
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });

      // the other tabs
      for (const [k, expect] of [['offsite', /Offsite copies/], ['full', /Full-site backups/], ['safety', /Safety copies/], ['destinations', /Add a destination/]]) {
        await page.click(`#tabs [data-t=${k}]`); await page.waitForFunction((r) => new RegExp(r).test(document.querySelector('#pane').textContent), expect.source);
        assert.ok(await overflow(page) <= 0, `no sideways scrolling on ${k}`); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `backups-${k}-${w}.png`), fullPage: true });
      }
      assert.match(await page.textContent('#pane'), /This server/); assert.match(await page.textContent('#pane'), /Built in/);
      await page.click('#pane [data-test]'); await page.waitForSelector('#pane [data-result] .banner'); assert.match(await page.textContent('#pane [data-result]'), /Connected\. A small test file was written/);
      await page.click('#add'); await page.waitForSelector('.sheet #dt'); await page.click('.sheet #dt'); await page.click('.sheet .select-option[data-value=s3]'); await page.waitForSelector('.sheet [data-f=secretKey]');
      assert.ok(await overflow(page) <= 0); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `backups-adddest-${w}.png`) });
      assert.equal(await page.locator('.sheet [data-f=secretKey]').getAttribute('type'), 'password');
      await page.click('.sheet [data-cancel]');
      await page.click('#tabs [data-t=safety]'); await page.waitForSelector('#list .feed'); assert.match(await page.textContent('#list'), /myboxstock-pre-restore-2026-01-02/);
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); }
  });
}
