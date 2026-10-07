// TEST / e2e-backup-setup-ui — the Backup setup panel, the one-row tab strip and restoring from an offsite copy, in a real browser at phone and laptop width.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase', SHOTS = process.env.SHOT_DIR || '', API = '/api/host/backups';
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const chipOf = (page, step) => page.textContent(`[data-step=${step}] .chip`);

async function signIn(page, srv) {
  await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
  const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');
}

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: Backup setup, tab row and offsite restore work at ${w}px (${label})`, { skip, timeout: 280000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: w, height: h } });
    const store = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-e2e-store-'));
    page.setDefaultTimeout(30000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401|status of 400/.test(m.text())) errors.push(m.text()); });
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Setup Shots', email: 's@example.com', username: 'sue', password: PW });
      await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
      await signIn(page, srv); await page.goto(srv.base + '/host/#/backups'); await page.waitForSelector('#setup .setup-step');

      // fresh install: only step 1 open, the rest locked, status says Local only, no mail warning missing
      let t = await page.textContent('#setup'); assert.match(t, /Backup setup/); assert.match(t, /Not protected yet/); assert.match(t, /Local only \(same disk\)/); assert.match(t, /Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway\./);
      assert.deepEqual(await page.locator('#setup .setup-step .chip').allTextContents(), ['Next', 'Locked', 'Locked', 'Locked']); assert.equal(await page.locator('#setup .setup-step.locked').count(), 3);
      assert.ok(await overflow(page) <= 0, 'no sideways scrolling');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-fresh-${w}.png`), fullPage: true });

      // the tab row: one row, 44px tabs, scrolls sideways on a phone with no visible bar, selected tab scrolled into view
      const row = await page.evaluate(() => { const r = document.querySelector('#tabs'), bs = [...r.querySelectorAll('button')], cs = getComputedStyle(r); return { tops: [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top)))], hs: bs.map(b => b.getBoundingClientRect().height), wrap: cs.flexWrap, bar: cs.scrollbarWidth, scrolls: r.scrollWidth > r.clientWidth, more: r.className }; });
      assert.equal(row.tops.length, 1, 'all tabs on one row'); assert.equal(row.wrap, 'nowrap'); assert.equal(row.bar, 'none'); assert.ok(row.hs.every(x => x >= 43.5), '44px tabs: ' + row.hs);
      if (w <= 640) { assert.ok(row.scrolls, 'the row scrolls sideways on a phone'); assert.match(row.more, /more-end/, 'a fade shows there is more'); }
      await page.click('#tabs [data-t=destinations]');
      const vis = await page.evaluate(() => { const r = document.querySelector('#tabs').getBoundingClientRect(), b = document.querySelector('#tabs button.on').getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1; });
      assert.ok(vis, 'the selected tab is visible'); assert.ok(await overflow(page) <= 0); if (w <= 640) assert.match(await page.getAttribute('#tabs', 'class'), /more-start/);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-tabs-destinations-${w}.png`) });

      // locked tabs say why and cannot be changed; the Full-site switch has a label; the failure-email switch warns that mail is not set up
      assert.equal(await page.locator('#pane #lock-note').count(), 1); assert.match(await page.textContent('#lock-note'), /Locked until the backup passphrase is set and confirmed/); assert.equal(await page.locator('#add').isDisabled(), true);
      await page.click('#tabs [data-t=offsite]'); await page.waitForSelector('#pane #lock-note'); assert.equal(await page.locator('#now').isDisabled(), true); assert.equal(await page.locator('#oen').isDisabled(), true);
      await page.click('#tabs [data-t=full]'); await page.waitForSelector('#pane #fen');
      assert.equal(await page.getAttribute('#fen', 'aria-label'), 'Make a full-site backup on a schedule'); assert.match(await page.textContent('#pane'), /Make a full-site backup on a schedule/); assert.equal(await page.locator('#fen').isDisabled(), true);
      assert.match(await page.textContent('#mail-warn'), /No mail is set up.*Emails and alerts only work after the Email section is set up/);
      assert.ok(await overflow(page) <= 0); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-full-locked-${w}.png`), fullPage: true });

      // step 1
      await page.click('#tabs [data-t=frequent]');
      await page.fill('#sp-pass', 'short'); await page.fill('#sp-conf', 'short'); await page.check('#sp-saved'); await page.click('#sp-go');
      await page.waitForSelector('.toast.err'); assert.match(await page.textContent('.toast.err'), /at least 12 characters/);
      await page.fill('#sp-pass', PASS); await page.fill('#sp-conf', PASS); await page.uncheck('#sp-saved'); await page.click('#sp-go'); await page.waitForFunction(() => [...document.querySelectorAll('.toast.err')].some(t => /Tick the box/.test(t.textContent)));
      await page.check('#sp-saved'); await page.click('#sp-go'); await page.waitForFunction(() => document.querySelector('[data-step=where] .chip')?.textContent === 'Next');
      assert.deepEqual(await page.locator('#setup .setup-step .chip').allTextContents(), ['Done', 'Next', 'Locked', 'Locked']);
      await page.click('#tabs [data-t=destinations]'); await page.waitForSelector('#add'); assert.equal(await page.locator('#add').isDisabled(), false, 'the Destinations tab is unlocked now');

      // step 2: this server only is a deliberate, acknowledged choice
      await page.check('#setup input[name=sw][value=no]'); assert.match(await page.textContent('#sw-more'), /lost with the disk/); await page.click('#sw-go');
      await page.waitForFunction(() => document.querySelector('[data-step=keep] .chip')?.textContent === 'Next'); assert.equal(await chipOf(page, 'where'), 'Done');
      // step 3: the choices show the estimate
      assert.match(await page.textContent('[data-step=keep]'), /At these settings you will hold about/); assert.equal(await page.locator('#setup input[name=sk]').count(), 3);
      await page.check('#setup input[name=sk][value=recommended]'); await page.click('#sk-go'); await page.waitForFunction(() => document.querySelector('[data-step=prove] .chip')?.textContent === 'Next');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-step4-${w}.png`), fullPage: true });
      // step 4: prove it, then and only then Protected
      assert.match(await page.textContent('#setup-state'), /Not protected yet/);
      await page.click('#sv-go'); await page.waitForFunction(() => document.querySelector('[data-step=prove] .chip')?.textContent === 'Done', null, { timeout: 90000 });
      assert.deepEqual(await page.locator('#setup .setup-step .chip').allTextContents(), ['Done', 'Done', 'Done', 'Done']); assert.match(await page.textContent('#setup-status'), /Local only \(same disk\)/);
      assert.match(await page.textContent('#setup-state'), /Not protected yet/, 'all steps done but nothing leaves the server: never Protected above a Local only warning');
      assert.deepEqual(await page.locator('#setup .setup-step .chip').allTextContents(), ['Done', 'Done', 'Done', 'Done']); assert.match(await page.textContent('#setup-status'), /Local only \(same disk\)/);
      assert.ok(await overflow(page) <= 0); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-done-${w}.png`), fullPage: true });
      // passphrase care sits in plain view under step 1 (no menu): Check, Change, Reset
      const care = await page.locator('#pass-care button').allTextContents(); assert.deepEqual(care, ['Check my passphrase', 'Change passphrase', 'Reset (forgotten)']);
      if (w <= 640) { const small = await page.evaluate(() => [...document.querySelectorAll('#pass-care .btn')].filter(b => b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim())); assert.deepEqual(small, [], 'passphrase buttons are 44px tall'); }
      assert.ok(await overflow(page) <= 0); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-passphrase-care-${w}.png`), fullPage: true });
      await page.click('#pc-check'); await page.fill('.sheet #pk-cur', 'not my passphrase'); await page.click('.sheet #pgo'); await page.waitForSelector('.sheet #pk-out .banner.red'); assert.match(await page.textContent('#pk-out'), /does not match/);
      await page.fill('.sheet #pk-cur', PASS); await page.click('.sheet #pgo'); await page.waitForSelector('.sheet #pk-out .banner.blue'); assert.match(await page.textContent('#pk-out'), /matches the saved passphrase/);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-passphrase-check-${w}.png`) });
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });
      await page.click('#pc-change'); assert.match(await page.textContent('.sheet'), /older .*still need the old passphrase|before the change still need the old passphrase/);
      await page.fill('.sheet #pc-cur', 'wrong current one'); await page.fill('.sheet #pc-new', PASS + ' two'); await page.fill('.sheet #pc-conf', PASS + ' two'); await page.check('.sheet #pc-saved'); await page.click('.sheet #pgo');
      await page.waitForFunction(() => [...document.querySelectorAll('.toast.err')].some(t => /not the current backup passphrase/.test(t.textContent)));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-passphrase-change-${w}.png`) });
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });
      await page.click('#pc-reset'); assert.match(await page.textContent('.sheet'), /can never be opened again/); await page.fill('.sheet #pr-new', PASS + ' three'); await page.fill('.sheet #pr-conf', PASS + ' three'); await page.check('.sheet #pr-saved'); await page.click('.sheet #pgo');
      await page.waitForFunction(() => [...document.querySelectorAll('.toast.err')].some(t => /older encrypted copy can never be opened/.test(t.textContent)), null, { timeout: 15000 });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `setup-passphrase-reset-${w}.png`) });
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });
      await page.click('#tabs [data-t=full]'); await page.waitForSelector('#fp-change'); assert.equal(await page.locator('#fpp').count(), 0, 'the Full-site tab no longer swaps the passphrase without the current one'); assert.equal(await page.locator('#fp-check').count(), 1);
      await page.click('#tabs [data-t=frequent]'); await page.waitForSelector('#setup');

      // an offsite copy to restore from (a folder outside the default one counts as a destination and is encrypted)
      const made = await c.req('POST', `${API}/destinations`, { type: 'folder', name: 'Store', enabled: false, settings: { path: store } }); assert.equal(made.status, 200, JSON.stringify(made.data));
      assert.equal((await c.req('POST', `${API}/destinations/${made.data.id}/test`)).data.ok, true);
      assert.equal((await c.req('PUT', `${API}/destinations/${made.data.id}`, { name: 'Store', enabled: true, settings: { path: store }, secrets: {} })).status, 200);
      assert.equal((await c.req('PUT', `${API}/tiers`, { offsite: { enabled: true, destinations: [made.data.id] } })).status, 200);
      assert.equal((await c.req('POST', `${API}/run/offsite`)).status, 200);
      const good = fs.readdirSync(store).find(f => /^myboxstock-offsite-.*\.mbsenc$/.test(f)), bytes = fs.readFileSync(path.join(store, good)); bytes[Math.floor(bytes.length / 2)] ^= 0xff;
      fs.writeFileSync(path.join(store, 'myboxstock-offsite-2026-01-01-00-00-00.db.mbsenc'), bytes);
      await page.click('#tabs [data-t=offsite]'); await page.waitForSelector('#list [data-roff]'); assert.equal(await page.locator('#list [data-roff]').count(), 2); assert.equal(await page.locator('#list [data-rtest]').count(), 2);
      if (w <= 640) { const small = await page.evaluate(() => [...document.querySelectorAll('#list .btn')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim())); assert.deepEqual(small, [], 'row buttons are 44px'); }

      // the good copy: the test runs by itself, Restore stays off until RESTORE is typed, with the reason shown
      await page.locator(`#list tr:has-text("${good}") [data-roff]`).click(); await page.waitForSelector('.sheet #otest .banner');
      await page.waitForFunction(() => /passed every check/.test(document.querySelector('.sheet #otest').textContent));
      t = await page.textContent('.sheet'); for (const want of ['The destination can be reached', 'passphrase opens the copy', 'integrity check', 'fits this version of the app', 'compared with the live site', 'scratch copy was deleted', 'safety copy']) assert.match(t, new RegExp(want));
      assert.equal(await page.locator('.sheet #otest .chip.red').count(), 0); assert.equal(await page.locator('.sheet #ogo').isDisabled(), true); assert.match(await page.textContent('#owhy'), /Type RESTORE/);
      assert.ok(await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth; }), 'the sheet does not scroll sideways');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `offsite-restore-good-${w}.png`) });
      await page.fill('.sheet #ocf', 'RESTORE'); assert.equal(await page.locator('.sheet #ogo').isDisabled(), false);
      await page.fill('.sheet #ocf', 'nope'); assert.equal(await page.locator('.sheet #ogo').isDisabled(), true);
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });

      // the damaged copy: failed checks, Restore stays disabled even with RESTORE typed, and the reason is the failure
      await page.locator('#list tr:has-text("2026-01-01-00-00-00") [data-roff]').click(); await page.waitForFunction(() => /did not pass/.test(document.querySelector('.sheet #otest')?.textContent || ''));
      assert.ok(await page.locator('.sheet #otest .chip.red').count() >= 1); await page.fill('.sheet #ocf', 'RESTORE');
      assert.equal(await page.locator('.sheet #ogo').isDisabled(), true, 'no override'); assert.match(await page.textContent('#owhy'), /Restore is off: This copy did not pass/);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `offsite-restore-bad-${w}.png`) });
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });

      // the stand-alone Test restore: same checks, nothing to restore
      await page.locator(`#list tr:has-text("${good}") [data-rtest]`).click(); await page.waitForFunction(() => /passed every check/.test(document.querySelector('.sheet #otest')?.textContent || ''));
      assert.equal(await page.locator('.sheet #ogo').count(), 0); assert.match(await page.textContent('.sheet h2'), /Test restore/);
      await page.click('.sheet [data-cancel]'); await page.waitForSelector('.sheet', { state: 'detached' });
      // now a copy has left the server and its test passed: Protected, and only now
      await page.goto(srv.base + '/host/#/backups'); await page.reload(); await page.waitForSelector('#setup .setup-step');
      assert.match(await page.textContent('#setup-state'), /^Protected$/); assert.match(await page.textContent('#setup-status'), /Off-site and verified/);
      assert.deepEqual(errors, []); // (the 400s are the refused short passphrase and unsaved box on purpose)
    } finally { await br.close(); srv.stop(); fs.rmSync(store, { recursive: true, force: true }); }
  });
}
