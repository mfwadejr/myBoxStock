// TEST / e2e-testrecord — a real browser: test steps with extra items, one "Tested on" date, the on/off switch, and Date received.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: test record details, tested-on date, switch off/on, date received', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Record Co'); await page.fill('#em', 'r@example.com'); await page.fill('#un', 'rita'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'rita@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');

    // add a device: items under the firmware step stay hidden until it is ticked
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#add'); await page.click('#add'); await page.fill('#f_uid', 'U1');
    assert.equal(await page.locator('[data-items="upgrade"]').isHidden(), true);
    assert.match(await page.inputValue('#tdate'), /^\d{4}-\d{2}-\d{2}$/); assert.match(await page.inputValue('#recv'), /^\d{4}-\d{2}-\d{2}$/);
    await page.check('[data-step=upgrade]'); assert.equal(await page.locator('[data-items="upgrade"]').isVisible(), true);
    const fieldIds = await page.locator('[data-items="upgrade"] input').evaluateAll(n => n.map(x => x.id));
    assert.equal(fieldIds.length, 4); // Launcher from/to, Firmware from/to
    await page.fill('#' + fieldIds[0], '1.0'); await page.fill('#' + fieldIds[1], '2.0'); await page.fill('#' + fieldIds[2], 'A'); await page.fill('#' + fieldIds[3], 'B');
    await page.fill('#tdate', '2026-09-01'); await page.fill('#recv', '2026-08-15');
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/testrecord.png` : '/tmp/testrecord.png' });
    await page.click('#go'); await page.waitForSelector('tr.click');

    // reopen: everything kept
    await page.click('tr.click'); await page.waitForSelector('#tdate');
    assert.equal(await page.inputValue('#tdate'), '2026-09-01'); assert.equal(await page.inputValue('#recv'), '2026-08-15');
    assert.equal(await page.inputValue('#' + fieldIds[0]), '1.0'); assert.equal(await page.inputValue('#' + fieldIds[3]), 'B');
    // untick hides the items but keeps the typed values
    await page.uncheck('[data-step=upgrade]'); assert.equal(await page.locator('[data-items="upgrade"]').isHidden(), true);
    await page.check('[data-step=upgrade]'); assert.equal(await page.inputValue('#' + fieldIds[1]), '2.0');
    await page.click('#go'); await page.waitForSelector('tr.click');
    assert.ok(await page.locator('th', { hasText: 'Tests' }).count());

    // Settings: the Details editor adds a Choice item to the first step; it shows up under that step when ticked
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('[data-k=sdt]');
    assert.match(await page.textContent('[data-k=sdt][data-i="4"]'), /Details \(2\)/);
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/testsettings.png` : '/tmp/testsettings.png' });
    await page.click('[data-k=sdt][data-i="0"]'); await page.click('#da'); await page.fill('[data-d=l][data-n="0"]', 'Grade');
    await page.click('#dt0'); await page.locator('#dt0').locator('xpath=..').locator('.select-option[data-value="choice"]').click(); await page.fill('[data-d=o][data-n="0"]', 'A, B, C');
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/testdetails.png` : '/tmp/testdetails.png' });
    await page.click('#go'); assert.match(await page.textContent('[data-k=sdt][data-i="0"]'), /Details \(1\)/);
    await page.click('#save'); await page.waitForSelector('.toast');
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('tr.click'); await page.click('tr.click'); await page.waitForSelector('#tdate');
    await page.check('[data-step=inspected]'); assert.equal(await page.locator('[data-items="inspected"] .select').count(), 1); await page.click('[data-cancel]');

    // switch the checklist off in Settings: the test record disappears everywhere (nothing deleted)
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#ten'); await page.uncheck('#ten'); await page.click('#save'); await page.waitForSelector('.toast');
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('tr.click');
    assert.equal(await page.locator('th', { hasText: 'Tests' }).count(), 0);
    await page.click('tr.click'); await page.waitForSelector('#recv'); assert.equal(await page.locator('#tdate').count(), 0); await page.click('[data-cancel]');
    // back on: the earlier record is still there
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#ten'); await page.check('#ten'); await page.click('#save'); await page.waitForSelector('.toast');
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('tr.click'); await page.click('tr.click'); await page.waitForSelector('#tdate');
    assert.equal(await page.inputValue('#tdate'), '2026-09-01'); assert.equal(await page.inputValue('#' + fieldIds[0]), '1.0');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
