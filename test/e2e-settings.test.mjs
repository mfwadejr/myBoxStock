// TEST / e2e-settings — a real browser: delete a built-in detail, warranty periods and countdown, and the stay-unlocked setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: remove a built-in detail, warranty countdown, unlock behaviour', { skip, timeout: 150000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Warranty Co'); await page.fill('#em', 'w@example.com'); await page.fill('#un', 'wanda'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'wanda@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');

    // 1. a built-in detail (Supplier) can be removed, after a confirmation
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#addf');
    const rows = await page.locator('[data-k=fl]').count();
    await page.locator('[data-k=rmf]').last().click(); await page.waitForSelector('.sheet #ok'); await page.click('.sheet #ok');
    assert.equal(await page.locator('[data-k=fl]').count(), rows - 1, 'Supplier is gone from the list');

    // a choice list can be changed, and the delete buttons sit at the far right of each row
    await page.locator('[data-k=ech]').first().click(); await page.fill('.sheet #o', 'New\nRefurbished\nUsed\nFor parts'); await page.click('.sheet #go');
    assert.match(await page.locator('[data-k=ech]').first().textContent(), /Choices \(4\)/);
    const rm = await page.locator('[data-k=rmf]').first().boundingBox(), sw = await page.locator('[data-k=fs]').first().boundingBox(); assert.ok(rm.x > sw.x, 'the delete button is right of the last checkbox');

    // 2. add a 6-month warranty period and make it the default
    await page.click('#addw'); await page.fill('.sheet #a', '6');
    await page.click('.sheet #go'); const wl = page.locator('[data-k=wl]'); assert.equal(await wl.last().inputValue(), '6 months');
    await page.locator('[data-k=wd]').last().click();

    // 3. stay unlocked after a refresh, with a short idle lock
    await page.click('#um'); await page.click('.select-option[data-value=stay]'); await page.fill('#ui', '30');
    await page.click('#save'); await page.waitForTimeout(800);

    // add a device, sell it, see the warranty countdown
    await page.goto(srv.base + '/app/#/inventory'); await page.click('#add');
    await page.fill('#f_uid', 'W-1'); await page.fill('#make_new', 'Acme'); await page.fill('#model_new', 'Box'); await page.fill('#cost', '10'); await page.fill('#price', '30'); await page.click('#go'); await page.waitForSelector('tr.click');
    await page.goto(srv.base + '/app/#/sell'); await page.waitForSelector('#scan'); await page.fill('#scan', 'W-1'); await page.press('#scan', 'Enter'); await page.fill('#nn', 'Buyer Two'); await page.click('#done'); await page.waitForSelector('.receipt');
    assert.match(await page.textContent('.receipt'), /Warranty: 6 months · ends .*In warranty · 18\d days remaining/); await page.click('[data-cancel]');
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click'); assert.match(await page.textContent('tr.click'), /In warranty · 18\d days remaining/);

    // refresh stays unlocked; sign-out wipes the stored key
    await page.reload(); await page.waitForSelector('.side', { timeout: 8000 }); assert.equal(await page.locator('#pw').count(), 0, 'no password prompt after a refresh');
    assert.ok(await page.evaluate(() => !!sessionStorage.getItem('bx.keep')));
    await page.click('.menu-btn').then(() => page.click('.menu-item[data-id=out]')); await page.waitForSelector('#l'); assert.ok(await page.evaluate(() => !sessionStorage.getItem('bx.keep')), 'sign-out wipes the key');

    // strict mode prompts again
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.side');
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#um'); await page.click('#um'); await page.click('.select-option[data-value=ask]'); await page.click('#save'); await page.waitForTimeout(800);
    assert.ok(await page.evaluate(() => !sessionStorage.getItem('bx.keep')), 'strict mode keeps nothing');
    await page.reload(); await page.waitForSelector('#pw');

    // idle lock: an old activity stamp is refused after refresh
    await page.fill('#pw', PW); await page.click('button.block'); await page.waitForSelector('.side');
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#um'); await page.click('#um'); await page.click('.select-option[data-value=stay]'); await page.click('#save'); await page.waitForTimeout(800);
    await page.evaluate(() => { const k = JSON.parse(sessionStorage.getItem('bx.keep')); k.at -= 31 * 60000; sessionStorage.setItem('bx.keep', JSON.stringify(k)); });
    await page.reload(); await page.waitForSelector('#pw');
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});
