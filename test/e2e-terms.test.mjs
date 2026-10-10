// TEST / e2e-terms — in the browser: the Terms box on sign-up (label, accessible error, 44px, phone layout), the legal pages inside the app,
// footer links in both apps, the "Updated terms" screen for Administrators, and the acceptance shown to the Host.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, fillLogin, Client } from './helpers.mjs';
import { TERMS_VERSION } from '../src/services/legal/index.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';

// Sideways scroll, and anything on the page that is a tap target but shorter than 44px.
// (the sign-in card pops in with a small scale animation, so measure after it has settled)
const settle = (p) => p.waitForTimeout(600);
const layout = () => ({ overflow: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('.btn, .check, .legal-links a')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map(e => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height)) });

test('browser: Terms box on sign-up, legal pages in the app, updated-terms screen, footers, and the Host sees the acceptance', { skip, timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), ctx = await br.newContext({ viewport: { width: 375, height: 667 } }), page = await ctx.newPage();
  page.setDefaultTimeout(15000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
    await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });

    // Sign-up: the checkbox has a label with links, and without a tick nothing is created and an accessible error says why.
    await page.goto(srv.base + '/app/#/signup'); await page.waitForSelector('#tc');
    assert.equal(await page.locator('label.check:has(#tc)').count(), 1, 'the checkbox sits inside its label');
    assert.match(await page.textContent('label.check:has(#tc)'), /I agree to the Terms of Service and Privacy Policy/);
    assert.deepEqual(await page.$$eval('label.check:has(#tc) a', as => as.map(a => a.getAttribute('href'))), ['#/legal/terms-of-service', '#/legal/privacy-policy']);
    assert.equal(await page.getAttribute('#tc', 'aria-describedby'), 'tc-err'); assert.equal(await page.getAttribute('#tc-err', 'role'), 'alert'); assert.ok(await page.locator('#tc-err').isHidden(), 'no error before trying');
    await settle(page); let l = await page.evaluate(layout); assert.ok(l.overflow <= 1, `sign-up scrolls sideways by ${l.overflow}px at 375`); assert.deepEqual(l.small, [], 'tap targets under 44px on sign-up');
    assert.equal(await page.locator('.authcard .legal-links a').count(), 4, 'legal links under the sign-up form');
    await page.fill('#bn', 'Terms Co'); await page.fill('#em', 't@example.com'); await page.fill('#un', 'tia'); await page.fill('#pw', PW);
    await page.click('button.block'); await page.waitForSelector('#tc-err:not([hidden])');
    assert.equal(await page.getAttribute('#tc', 'aria-invalid'), 'true'); assert.match(await page.textContent('#tc-err'), /Tick the box/); assert.ok(await page.isVisible('#bn'), 'still on the sign-up form');
    assert.equal((await c.req('GET', '/api/host/accounts')).data.length, 0, 'no account was created');
    await page.check('#tc'); assert.ok(await page.locator('#tc-err').isHidden(), 'the error clears when ticked');
    // The links open the pages inside the app, in a new tab, without signing in.
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('label.check a:first-of-type')]);
    await pop.waitForSelector('.doc h1'); assert.equal(await pop.textContent('.doc h1'), 'Terms of Service'); assert.match(await pop.textContent('.doc'), new RegExp(`Version ${TERMS_VERSION} · Effective 2026-10-07`)); assert.match(await pop.textContent('.doc'), /DRAFT/);
    l = await pop.evaluate(layout); assert.ok(l.overflow <= 1, `legal page scrolls sideways by ${l.overflow}px at 375`); await pop.click('.doc-toc a:has-text("Privacy Policy")'); await pop.waitForFunction(() => document.querySelector('.doc h1')?.textContent === 'Privacy Policy');
    await pop.click('#lback'); await pop.waitForSelector('[data-mode].on'); await pop.close();
    await page.click('button.block'); await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(); await page.click('#go');

    // Signed in: the footer shows the four legal links, opening the pages inside the app.
    await fillLogin(page, 'tia@' + id); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.main');
    assert.equal(await page.locator('.legal-foot .legal-links a').count(), 4);
    await page.click('.legal-foot a[href="#/legal/terms-of-service"]'); await page.waitForSelector('.main .doc h1'); assert.equal(await page.textContent('.main .doc h1'), 'Terms of Service');
    l = await page.evaluate(layout); assert.ok(l.overflow <= 1, 'legal page inside the app scrolls sideways'); assert.deepEqual(l.small, []);

    // The Host sees the acceptance on the account's detail, and the footer links in the Host Console.
    const host = await br.newPage({ viewport: { width: 1280, height: 800 } }); host.setDefaultTimeout(15000);
    await host.goto(srv.base + '/host/'); await host.waitForSelector('input'); const ins = await host.$$('input'); await ins[0].fill('admin'); await ins[1].fill(PW); await host.keyboard.press('Enter'); await host.waitForSelector('.main');
    assert.deepEqual(await host.$$eval('.legal-foot a', as => as.map(a => a.getAttribute('href'))), ['/legal/terms-of-service', '/legal/privacy-policy', '/legal/data-responsibility-and-acceptable-use', '/legal/billing-trial-and-refund-terms']);
    await host.goto(srv.base + '/host/#/accounts'); await host.waitForSelector('tr[data-id]'); await host.click('tr[data-id]'); await host.waitForSelector('.sheet h3:has-text("Terms")');
    assert.match(await host.textContent('.sheet'), new RegExp(`Terms accepted[\\s\\S]*Version ${TERMS_VERSION}, accepted`));

    if (sqlite) { // The terms change: the Administrator is asked at the next sign-in and cannot continue without accepting.
      const { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000');
      await page.evaluate(() => AccountApp.signOut()); await page.waitForSelector('#f');
      d.prepare('UPDATE accounts SET terms_version = ?, terms_accepted_at = ? WHERE account_code = ?').run('an-older-version', 1, id);
      await fillLogin(page, 'tia@' + id); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('#tc');
      assert.equal(await page.textContent('h1'), 'Updated terms'); assert.equal(await page.locator('.main').count(), 0, 'the app is not shown yet');
      await settle(page); l = await page.evaluate(layout); assert.ok(l.overflow <= 1, 'updated-terms screen scrolls sideways'); assert.deepEqual(l.small, []);
      await page.click('button.block'); await page.waitForSelector('#tc-err:not([hidden])'); assert.equal(await page.locator('.main').count(), 0, 'cannot continue without ticking');
      await page.check('#tc'); await page.click('button.block'); await page.waitForSelector('.main');
      assert.equal((await new Client(srv.base).req('GET', '/api/app/public-config')).data.termsVersion, TERMS_VERSION);
      assert.equal(d.prepare('SELECT terms_version FROM accounts WHERE account_code = ?').get(id).terms_version, TERMS_VERSION);
    }
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
