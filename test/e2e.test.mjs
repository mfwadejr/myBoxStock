// TEST / e2e — a real browser walks the whole encrypted flow: sign up, set up encryption, add devices, sell, sign out and back in, recover.
// Skipped automatically where no browser is installed (set CHROMIUM_PATH to enable elsewhere).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : !sqlite ? 'SQLite-only (edits the database file)' : false;
const PW = 'Sup3rSecretPass!';

test('browser: setup, add, sell, sign out, unlock, recovery key, CSV import', { skip, timeout: 120000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Demo Boxes'); await page.fill('#em', 'd@example.com'); await page.fill('#un', 'dana'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await page.fill('#l', login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); const key = (await page.textContent('.recovery-key')).trim(); assert.equal(key.length, 52);
    assert.ok(await page.isDisabled('#go'), 'cannot continue before confirming the key is saved'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');

    // Settings: track a custom detail and show it on the sale
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#addf'); await page.click('#addf'); await page.fill('#n', 'Firmware'); await page.click('.sheet #go'); await page.waitForSelector('[data-k=fs]');
    await page.locator('[data-k=fs]').last().check(); await page.click('#save'); await page.waitForTimeout(600);

    await page.goto(srv.base + '/app/#/inventory'); await page.click('#add');
    await page.fill('#f_uid', 'UID-1001'); await page.fill('#model', 'V6 Box'); await page.fill('#cost', '40'); await page.fill('#price', '75'); await page.fill('input[id^="f_c"]', 'FW 2.4'); await page.click('#allt'); await page.fill('#tnotes', 'Remote paired and tested'); await page.click('#more'); await page.waitForTimeout(500);
    await page.fill('#f_uid', 'UID-1002'); await page.fill('#model', 'V6 Box'); await page.fill('#cost', '40'); await page.fill('#price', '75'); await page.click('#go'); await page.waitForSelector('tr.click');
    assert.equal(await page.locator('tr.click').count(), 2);

    await page.goto(srv.base + '/app/#/sell'); await page.waitForSelector('#scan');
    await page.fill('#scan', 'uid-1001'); await page.press('#scan', 'Enter'); await page.fill('#scan', 'UID-1002'); await page.press('#scan', 'Enter'); await page.fill('#scan', 'NOPE'); await page.press('#scan', 'Enter');
    assert.match(await page.textContent('#msg'), /Nothing in your inventory matches/); assert.equal(await page.locator('.cart-line').count(), 2); assert.match(await page.textContent('#tot'), /150\.00/);
    await page.click('[data-mode=new]'); await page.fill('#nn', 'Zelda Fitz'); await page.click('#done'); await page.waitForSelector('.receipt'); assert.match(await page.textContent('.receipt'), /Zelda Fitz/); assert.match(await page.textContent('.receipt'), /Firmware: FW 2\.4/);
    assert.doesNotMatch(await page.textContent('.receipt'), /Remote tested/); await page.check('#wt'); assert.match(await page.textContent('.receipt'), /✓ Remote tested/); assert.match(await page.textContent('.receipt'), /Remote paired and tested/);
    assert.match(await page.textContent('.receipt'), /— Device inspected/, 'the second device was never tested and the record says so'); await page.click('[data-cancel]');
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('.empty'); // both devices are sold, so none show as available

    // what the server holds is unreadable
    const raw = await page.evaluate(async () => (await (await fetch('/api/app/vault/records')).json()).records.map(r => r.blob).join(''));
    assert.ok(!raw.includes('UID-1001') && !raw.includes('Zelda'));

    // sign out and in again: password unlocks; reload asks for the password again
    await page.click('#out'); await page.fill('#l', login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.side');
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click'); assert.equal(await page.locator('tr.click').count(), 1);
    await page.reload(); await page.waitForSelector('#pw'); await page.fill('#pw', 'wrong-password-1'); await page.click('button.block'); await page.waitForTimeout(500); assert.ok(await page.isVisible('#pw'), 'wrong password does not unlock');
    await page.fill('#pw', PW); await page.click('button.block'); await page.waitForSelector('.side');

    // password reset by email leaves no key: the recovery key brings access back
    await page.click('#out'); const { DatabaseSync } = await import('node:sqlite'); const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.prepare('DELETE FROM account_keys').run(); d.close();
    await page.fill('#l', login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('#rk');
    await page.fill('#rk', 'AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA'); await page.fill('#pw', PW); await page.click('button.block'); await page.waitForTimeout(500); assert.ok(await page.isVisible('#rk'), 'wrong recovery key is refused');
    await page.fill('#rk', key); await page.fill('#pw', PW); await page.click('button.block'); await page.waitForSelector('.side');

    // CSV import skips duplicates
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#imp'); const csv = path.join(os.tmpdir(), `imp-${Date.now()}.csv`); fs.writeFileSync(csv, 'uid,model,cost,price,condition\nCSV-1,X5,30,60,Used\nCSV-2,X5,30,60,New\nCSV-1,X5,1,1,New\n');
    await page.setInputFiles('#file', csv); await page.waitForSelector('#go'); assert.match(await page.textContent('.sheet .sub'), /2 devices will be added\. 1 row will be skipped/); await page.click('#go'); await page.waitForSelector('tr.click');
    assert.equal(await page.locator('tr.click').count(), 2); fs.rmSync(csv, { force: true });
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});
