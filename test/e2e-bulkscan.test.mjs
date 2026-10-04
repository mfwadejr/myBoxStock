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
    await page.click('#bulk'); await page.fill('#make_new', 'Acme'); await page.fill('#model_new', 'Box'); await page.fill('#cost', '10'); await page.fill('#price', '25');
    const scan = async (v) => { await page.fill('#scanbox', v); await page.press('#scanbox', 'Enter'); };
    for (const v of ['UID A1', 'SN S1', 'MAC 00:11']) await scan(v);
    for (const v of ['UID B2', 'SN S2']) await scan(v); await scan('');
    await scan('a1'); assert.match(await page.textContent('#bmsg'), /already scanned/);
    assert.equal(await page.locator('#blist .chip').count(), 2);
    assert.equal(await page.locator('.sheet #f_uid').count(), 0, 'identifiers are scanned, not shared fields');
    assert.equal(await page.locator('.sheet #blist .chip').first().textContent().then(t => t.includes('A1') && t.includes('S1')), true);
    await page.click('#bsave'); await page.waitForSelector('tr.click');
    assert.equal(await page.locator('tbody tr.click').count(), 2);
    const text = await page.locator('tbody').first().textContent(); assert.ok(text.includes('A1') && text.includes('B2') && !text.includes('UID'));
    await page.locator('tbody tr.click').first().click(); await page.waitForSelector('#f_serial');
    assert.ok(['S1', 'S2'].includes(await page.inputValue('#f_serial')), 'serial number was saved');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
