// TEST / t52-printer-fit — a real browser: Fit to my printer. The fit math, the numbered fit test page, a browser with no fit is asked before it can print, the DYMO starting point,
// the fit is kept for this browser and also offered (from the account) to a different browser, and the Tweak section.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: Fit to my printer', { skip, timeout: 280000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
  const ctx1 = await br.newContext({ viewport: { width: 1280, height: 1000 } }), page = await ctx1.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const pick = async (p, id, value) => { await p.click('#' + id); await p.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${value}"]`).click(); };
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Fit Co'); await page.fill('#em', 'f@example.com'); await page.fill('#un', 'fay'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'fay@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go');
    await page.waitForSelector('.side, .tabbar, nav', { timeout: 20000 }).catch(() => {});

    // the math: shrink about the centre to what the printer reaches, and centre in it
    const m = await page.evaluate(() => { const f = AccountApp.labels.fitFrom; return [f('dymo', { t: 6, b: 0, l: 0, r: 0 }), f('dymo', { t: 0, b: 0, l: 2, r: 6 }), f('dymo', { t: 0, b: 0, l: 0, r: 0 }), f('4x6', { t: 3, b: 3, l: 1, r: 1 }), f('dymo', { t: 9, b: 0, l: 0, r: 0 })]; });
    assert.deepEqual(m[0], { x: 0, y: 3, fit: 96 }, 'cut at the top: move down 3 mm and shrink to 96%');
    assert.deepEqual(m[1], { x: -2, y: 0, fit: 92 }, 'more cut on the right than the left: move left');
    assert.deepEqual(m[2], { x: 0, y: 0, fit: 100 }, 'nothing cut: no change');
    assert.equal(m[3].x, 0); assert.equal(m[3].y, 0); assert.ok(m[3].fit >= 95 && m[3].fit < 100);
    assert.equal(m[4].fit, 94);

    // Settings, DYMO size: this browser is not set up, and the test label asks first, offering the DYMO starting point
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#lsz'); await pick(page, 'lsz', 'dymo');
    assert.match(await page.textContent('#lsfit >> xpath=../..'), /not set up/);
    await page.click('#ltest'); await page.waitForSelector('.sheet #lask');
    assert.ok(await page.locator('.sheet #lprint').isDisabled() && await page.locator('.sheet #lpdf').isDisabled(), 'Print and PDF wait for a choice');
    assert.match(await page.textContent('.sheet #lstart'), /2 mm down, 95%/); assert.equal(await page.locator('.sheet [data-use]').count(), 0, 'no other browser has saved a fit yet');

    // Fit to my printer: the numbered fit test page prints, then four numbers give the fit
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; window.dispatchEvent(new Event('afterprint')); }; });
    await page.click('.sheet #lfitcal'); await page.waitForSelector('.sheet #cpage .fitcal-svg');
    assert.equal(await page.locator('#cpage line').count(), 40, 'a ruler of ten lines at each of the four edges');
    assert.equal(await page.locator('#cpage text').count(), 40 + 4 + 3, 'numbers on every line, the four edge names and the instructions');
    assert.ok(await page.locator('.sheet #csave').isDisabled());
    await page.click('.sheet #cprint'); assert.equal(await page.evaluate(() => window.__printed), 1);
    await page.fill('.sheet #fit-t', '6'); await page.fill('.sheet #fit-b', '0'); await page.fill('.sheet #fit-l', '0'); await page.fill('.sheet #fit-r', '0');
    assert.match(await page.textContent('.sheet #cres'), /3 mm down, 96%/); await page.click('.sheet #csave'); await page.waitForTimeout(600);
    await page.waitForSelector('.sheet #lfittw'); assert.match(await page.textContent('.sheet #lfitbox'), /3 mm down, 96%/);
    assert.ok(!(await page.locator('.sheet #lprint').isDisabled()), 'printing works once the browser is fitted');
    assert.deepEqual(await page.evaluate(() => { const l = document.querySelector('.sheet .label'); return [l.dataset.sx, l.dataset.sy, l.dataset.fit]; }), ['0', '3', '96']);
    const mine = await page.evaluate(() => AccountApp.labels.myFit('dymo')); assert.deepEqual(mine, { x: 0, y: 3, fit: 96 });
    assert.equal(await page.evaluate(() => AccountApp.labels.myFit('4x6')), null, 'the fit is per label size');
    // an Administrator's fit is also kept in the account for other browsers
    const acct = await page.evaluate(() => AccountApp.store.config().label.fits); assert.equal(acct.length, 1); assert.deepEqual(acct[0].sizes.dymo, { x: 0, y: 3, fit: 96 }); assert.match(acct[0].name, /Chrome/);
    // Tweak (advanced): the three selects, saved as this browser's fit
    await page.click('.sheet #lfittw'); await pick(page, 'lfy', '4'); await page.click('.sheet #lfsave'); await page.waitForTimeout(500);
    assert.equal((await page.evaluate(() => AccountApp.labels.myFit('dymo'))).y, 4);
    await page.locator('.sheet [data-cancel]').last().click(); await page.waitForTimeout(350);

    // a different browser (a new profile) signs in to the same account: it is asked, and offered the first browser's fit
    const ctx2 = await br.newContext({ viewport: { width: 1280, height: 1000 } }), p2 = await ctx2.newPage(); p2.setDefaultTimeout(10000); p2.on('pageerror', e => errors.push(e.message));
    await p2.goto(srv.base + '/app/'); await fillLogin(p2, login); await p2.fill('#p', PW); await p2.click('button.block');
    await p2.waitForSelector('.side, .tabbar, nav', { timeout: 20000 }).catch(() => {});
    await p2.goto(srv.base + '/app/#/settings'); await p2.waitForSelector('#lsz'); await pick(p2, 'lsz', 'dymo'); await p2.click('#ltest'); await p2.waitForSelector('.sheet #lask');
    assert.ok(await p2.locator('.sheet #lprint').isDisabled(), 'a new browser must choose before printing');
    assert.match(await p2.textContent('.sheet [data-use="0"]'), /Use the settings from Chrome.*4 mm down, 96%/);
    await p2.click('.sheet [data-use="0"]'); await p2.waitForSelector('.sheet #lfittw'); assert.ok(!(await p2.locator('.sheet #lprint').isDisabled()));
    assert.equal((await p2.evaluate(() => AccountApp.labels.myFit('dymo'))).fit, 96, 'kept for the second browser too');
    const ids = await p2.evaluate(() => AccountApp.store.config().label.fits.map(e => e.id)); assert.equal(new Set(ids).size, 2, 'two browsers are listed in the account');
    await ctx2.close();
  } finally { await br.close(); await srv.close?.(); }
  assert.deepEqual(errors, []);
});
