// TEST / e2e-bulkscan — scanner labels are stripped from identifiers, and Bulk scan adds many devices with shared details.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: scanned "UID" label is removed; bulk scan adds a batch and rejects repeats', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Scan Co'); await page.fill('#em', 's@example.com'); await page.fill('#un', 'sam'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'sam@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#bulk');
    await page.click('#add'); await page.fill('#f_uid', 'UID 273D00000019D128'); await page.fill('#make_new', 'Acme'); await page.fill('#model_new', 'Box'); await page.locator('#f_uid').blur();
    assert.equal(await page.inputValue('#f_uid'), '273D00000019D128', 'label removed after scan');
    await page.click('[data-cancel]');
    await page.click('#bulk'); await page.fill('#make_new', 'Acme'); await page.fill('#model_new', 'Box'); await page.fill('#cost', '10'); await page.fill('#price', '25'); await page.fill('#recv', '2026-01-15');
    const scan = async (v) => { await page.fill('#scanbox', v); await page.press('#scanbox', 'Enter'); };
    // every tracked identifier is ticked by default, so one device = UID + Serial + MAC (one device, not three)
    for (const k of ['uid', 'serial', 'mac']) assert.equal(await page.locator(`[data-id=${k}]`).isChecked(), true);
    await page.fill('#scanbox', 'UID A1A1A1A1'); await page.press('#scanbox', 'Enter'); await page.fill('#scanbox', 'SN S1S1S1S1'); await page.press('#scanbox', 'Enter'); await page.fill('#scanbox', 'MAC 00:AA'); await page.press('#scanbox', 'Enter');
    assert.equal(await page.locator('#blist .chip').count(), 1, 'three scans make one device'); await page.click('#undo'); await page.click('#undo'); await page.click('#undo');
    await page.uncheck('[data-id=serial]'); await page.uncheck('[data-id=mac]');
    // only the UID is scanned: one Enter per device, with the scanner's "UID" label removed
    await page.fill('#scanbox', 'UID 273D00000019D0E3'); assert.equal(await page.inputValue('#scanbox'), '273D00000019D0E3', 'the label is removed as soon as it is typed');
    await page.press('#scanbox', 'Enter'); assert.equal(await page.locator('#blist .chip').count(), 1);
    for (const v of ['UID', 'B2']) await scan(v);
    await scan('b2'); assert.match(await page.textContent('#bmsg'), /already scanned/);
    assert.equal(await page.locator('#blist .chip').count(), 2);
    // a scanner types fast and sends no Enter: the code is added by itself and the cursor stays in the box
    await page.locator('#scanbox').pressSequentially('UID D4D4D4D4', { delay: 5 }); await page.waitForFunction(() => document.querySelectorAll('#blist .chip').length === 3);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scanbox', 'cursor stays in the scan box');
    // a scanner that ends with Tab
    await page.locator('#scanbox').pressSequentially('E5E5E5E5', { delay: 5 }); await page.keyboard.press('Tab'); assert.equal(await page.locator('#blist .chip').count(), 4);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scanbox');
    // now also scan serial and MAC
    await page.check('[data-id=serial]'); await page.check('[data-id=mac]');
    for (const v of ['UID', 'C3', 'Serial number', 'S3', 'MAC 00:11']) await scan(v);
    assert.equal(await page.locator('#blist .chip').count(), 5);
    assert.equal(await page.locator('.sheet #f_uid').count(), 0, 'identifiers are scanned, not shared fields');
    await page.click('#bsave'); await page.waitForSelector('tr.click');
    assert.equal(await page.locator('tbody tr.click').count(), 5);
    const text = await page.locator('tbody').first().textContent(); assert.ok(text.includes('273D00000019D0E3') && text.includes('B2') && text.includes('C3') && !text.includes('UID'));
    await page.locator('tbody tr.click').first().click(); await page.waitForSelector('#recv');
    assert.equal(await page.inputValue('#recv'), '2026-01-15', 'the bulk date received was saved');
    await page.click('.sheet [data-cancel]');
    const cs = await page.evaluate(() => ['UID', 'UID\n273D00000019D128', 'UID273D00000019D128', 'UID: 273D00000019D128', 'SN 12345', 'Serial number', 'MAC 00:11:22', 'SN-98765', '273D00000019D128'].map(v => AccountApp.commerce.cleanScan(v)));
    assert.deepEqual(cs, ['', '273D00000019D128', '273D00000019D128', '273D00000019D128', '12345', '', '00:11:22', 'SN-98765', '273D00000019D128']);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
