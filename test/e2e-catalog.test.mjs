// TEST / e2e-catalog — a real browser: Make and Model are dropdowns; capitalisation never makes a second entry; the Administrator can add, rename and merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: make/model dropdowns, case-insensitive reuse, settings card (add, rename, merge, remove)', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Catalog Co'); await page.fill('#em', 'c@example.com'); await page.fill('#un', 'cara'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await page.fill('#l', login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    const pick = async (id, value) => { await page.click('#' + id); await page.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${value}"]`).click(); };
    const add = async (uid, make, model, typed) => {
      await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#add'); await page.click('#add'); await page.fill('#f_uid', uid);
      if (typed.make) { await pick('make', '__new'); await page.fill('#make_new', make); } else await pick('make', make);
      if (typed.model) { await pick('model', '__new'); await page.fill('#model_new', model); } else await pick('model', model);
      await page.click('#go'); await page.waitForSelector('tr.click');
    };

    // first device: nothing to pick yet, so the "new" boxes are open straight away
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#add'); await page.click('#add');
    assert.equal(await page.locator('#make_new').isVisible(), true, 'new-make box is open when there are no makes');
    await page.fill('#f_uid', 'C-1'); await page.fill('#make_new', 'Acme'); await page.fill('#model_new', 'Box One'); await page.click('#go'); await page.waitForSelector('tr.click');

    // second device: pick the make; only that make's models are offered; typing a different capitalisation reuses the existing spelling
    await page.click('#add'); await page.fill('#f_uid', 'C-2'); await pick('make', 'Acme');
    assert.equal(await page.locator('.sheet #model_new').isVisible(), false, 'models exist, so the new-model box is closed');
    await pick('make', '__new'); await page.fill('#make_new', 'ACME'); await pick('model', '__new'); await page.fill('#model_new', 'BOX ONE'); await page.click('#go'); await page.waitForSelector('tr.click');
    await add('C-3', 'Zeta', 'Z1', { make: true, model: true });
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#add'); await page.click('#add'); await pick('make', 'Zeta');
    const modelOptions = await page.locator('.sheet #modelw .select-option').allTextContents(); assert.deepEqual(modelOptions, ['—', 'Z1', 'Add new…'], 'models are filtered by the chosen make');
    await page.click('[data-cancel]');
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('tr.click'); const rowsText = await page.locator('tbody tr.click').allTextContents();
    assert.equal(rowsText.filter(t => /Acme Box One/.test(t)).length, 2, 'both Acme devices share one spelling (no ACME / BOX ONE)');

    // Settings card: pre-load a make, rename Zeta (updates its device), merge Zeta Co into Acme
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#addmk');
    await page.click('#addmk'); await page.fill('.sheet #n', 'Preloaded'); await page.click('.sheet #go'); await page.waitForSelector('[data-k=mkx][data-n="Preloaded"]');
    await page.click('[data-k=mda][data-n="Preloaded"]'); await page.fill('.sheet #n', 'P-100'); await page.click('.sheet #go'); await page.waitForSelector('[data-k=mdx][data-n="P-100"]');
    await page.click('[data-k=mkr][data-n="Zeta"]'); await page.fill('.sheet #n', 'Zeta Co'); await page.click('.sheet #go'); await page.waitForSelector('[data-k=mkr][data-n="Zeta Co"]');
    await page.click('[data-k=mkr][data-n="Zeta Co"]'); await page.fill('.sheet #n', 'acme'); await page.click('.sheet #go'); await page.waitForSelector('.sheet #ok'); await page.click('.sheet #ok');
    await page.waitForFunction(() => !document.querySelector('[data-k=mkr][data-n="Zeta Co"]'));
    assert.equal(await page.locator('[data-k=mkr]').count(), 2, 'Acme and Preloaded remain after the merge');
    assert.ok(await page.locator('.cat-model .cat-name', { hasText: 'Z1' }).count() >= 1, 'the merged make brought its model along');
    await page.click('[data-k=mdx][data-n="P-100"]'); await page.waitForSelector('.sheet #ok'); await page.click('.sheet #ok');
    await page.waitForFunction(() => !document.querySelector('[data-k=mdx][data-n="P-100"]'));
    await page.click('[data-k=mkx][data-n="Preloaded"]'); await page.waitForSelector('.sheet #ok'); await page.click('.sheet #ok');
    await page.waitForFunction(() => !document.querySelector('[data-k=mkx][data-n="Preloaded"]'));
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('tr.click');
    assert.equal((await page.locator('tbody tr.click').allTextContents()).filter(t => /Acme/.test(t)).length, 3, 'all three devices now sit under Acme');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
