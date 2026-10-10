// TEST / t48-import — the inventory CSV import (the only import there is) is checked with bad files, wrong columns, duplicates, quoting, very large files and the 5,000-device size
// of a big Demo mode account; and export then import brings every device field back (including text that starts with = + - @, which the export protects with a ').
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: inventory CSV import validation and export-import round trip', { skip, timeout: 280000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
  const page = await br.newPage({ viewport: { width: 1280, height: 900 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Import Co'); await page.fill('#em', 'imp@example.com'); await page.fill('#un', 'ivy'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'ivy@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.evaluate(async () => { const S = AccountApp.store, c = S.config(); await S.saveConfig({ ...c, fields: [...c.fields, { key: 'shelf', label: 'Shelf', type: 'text', core: false, enabled: true, lookup: false, unique: false, onSale: false }] }); });
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#imp');

    const items = () => page.evaluate(() => AccountApp.store.all('item').map(e => e.data));
    // Choose a file; the answer is either a message (toast) or the preview sheet.
    const give = async (csv, name = 'devices.csv') => {
      await page.evaluate(() => { document.querySelectorAll('.toasts .toast').forEach(t => t.remove()); document.querySelectorAll('.scrim').forEach(s => s.remove()); });
      await page.setInputFiles('#file', { name, mimeType: 'text/csv', buffer: Buffer.isBuffer(csv) ? csv : Buffer.from(csv) });
      await page.waitForFunction(() => document.querySelector('.sheet h2') || /\S/.test(document.querySelector('.toasts')?.textContent || ''), null, { timeout: 60000 });
      const sheet = await page.locator('.sheet h2').count();
      return sheet ? { sheet: await page.textContent('.sheet'), go: page.locator('.sheet #go') } : { toast: (await page.textContent('.toasts')).trim() };
    };
    const cancel = () => page.evaluate(() => document.querySelector('.sheet [data-cancel]')?.click());

    // ---- bad files: nothing is added, the message says what to do ----
    assert.match((await give('')).toast, /no rows to import/);
    assert.match((await give('uid,serial,mac\n')).toast, /no rows to import/);
    assert.match((await give('foo,bar\n1,2\n3,4\n')).toast, /first row must have column names, including at least one of: UID, Serial number, MAC address/);
    assert.match((await give('name,phone\nA,1\n')).toast, /first row must have column names/);
    assert.match((await give(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 1, 2, 3, 0xff]))).toast, /does not look like a CSV/, 'a zip or picture is refused');
    assert.match((await give(Buffer.concat([Buffer.from('uid\n'), Buffer.alloc(11 * 1024 * 1024, 0x61)]))).toast, /too large/, 'over 10 MB is refused before it is read');
    assert.match((await give('uid\n' + Array.from({ length: 20001 }, (_, i) => `R${i}`).join('\n'))).toast, /20001 rows\. Import up to 20000/);
    assert.equal((await items()).length, 0, 'no bad file added anything');

    // ---- a mixed file: BOM, CRLF, quotes, commas and line breaks inside a cell, duplicates, blanks, a bad status, extra and unknown columns ----
    const mixed = '﻿' + ['UID,Serial Number,MAC address,Make,Model,Cost,Price,Status,Notes,Shelf,Colour,Condition',
      'U1,SN1,AA:BB:CC:00:00:01,Roku,Ultra,20.00,50.00,available,"has, a comma",A1,black,new',
      'U2,SN2,,Roku,Ultra,"$1,234.50",99.99,SOLD,"line one\r\nline two",B2,,Refurbished',
      'U1,SN3,,Roku,Ultra,1,2,available,duplicate uid in this file,,,',
      ',,,Roku,Ultra,1,2,available,no identifier at all,,,',
      'U5,SN5,,Amazon,Fire 4K,abc,-5,whatever,"say ""hi""",C3,,Used',
      'u1,SN6,,Roku,Ultra,1,2,available,same uid different case,,,'].join('\r\n');
    const m = await give(mixed); assert.match(m.sheet, /3 devices will be added\. 3 rows will be skipped because they have no identifier or one that already exists/);
    await m.go.click(); await page.waitForFunction(() => AccountApp.store.all('item').length === 3);
    let got = await items(); const byUid = (u) => got.find(d => d.uid === u);
    assert.deepEqual(got.map(d => d.uid).sort(), ['U1', 'U2', 'U5']);
    assert.equal(byUid('U1').notes, 'has, a comma'); assert.equal(byUid('U1').cost, 2000); assert.equal(byUid('U1').price, 5000); assert.equal(byUid('U1').custom.shelf, 'A1'); assert.equal(byUid('U1').cond, 'New');
    assert.equal(byUid('U2').cost, 123450); assert.equal(byUid('U2').status, 'sold'); assert.equal(byUid('U2').notes, 'line one\r\nline two'); assert.equal(byUid('U2').cond, 'Refurbished');
    assert.equal(byUid('U5').status, 'available', 'an unknown status becomes Available'); assert.equal(byUid('U5').notes, 'say "hi"'); assert.equal(byUid('U5').price, 0, 'a negative price is not kept as a negative'); assert.equal(byUid('U5').cost, 0);
    assert.ok(got.every(d => d.addedAt > 0 && d.receivedOn), 'added and received dates are filled in');

    // ---- importing the same file again: everything is a duplicate, nothing can be imported ----
    const again = await give(mixed); assert.match(again.sheet, /0 devices will be added\. 6 rows will be skipped/); assert.equal(await again.go.isDisabled(), true); await cancel();
    assert.equal((await items()).length, 3);
    // a duplicate by serial or MAC alone
    const dup = await give('Serial number,MAC address\nSN1,\n,AA:BB:CC:00:00:01\nNEW-SN,NEW-MAC\n'); assert.match(dup.sheet, /1 device will be added\. 2 rows will be skipped/); await cancel();

    // ---- export then import: every field comes back, including text that starts with = + - @ ----
    await page.evaluate(async () => { const S = AccountApp.store, C = AccountApp.commerce, now = Date.now(), deletes = S.all('item').map(e => ({ type: 'item', id: e.id }));
      await S.commit({ deletes, puts: [
        { type: 'item', data: { uid: '=SUM(A1)', serial: '-SN-9', mac: '+MAC1', cond: 'Used', supplier: '@Supplier', custom: { shelf: 'Z9' }, make: 'Roku', model: 'Ultra', cost: 2500, price: 7500, status: 'returned', receivedOn: '2026-01-15', notes: 'back, "in" box', addedAt: now, checks: { inspected: { by: 'ivy', at: now }, upgrade: { by: 'ivy', at: now } }, checkVals: { upgrade: { launcher: { from: '1.0', to: '2.0' }, firmware: { from: '9', to: '10' } } }, testedOn: '2026-01-16', testNotes: 'works' } },
        { type: 'item', data: { uid: 'PLAIN-1', serial: '', mac: '', cond: 'New', supplier: '', make: 'Amazon', model: 'Fire 4K', cost: 0, price: 0, status: 'archived', receivedOn: '2026-02-01', notes: '', addedAt: now } }] }); });
    const origin = await items(); const csv = await page.evaluate(() => { const t = AccountApp.inventoryTable(); return AccountApp.commerce.toCsv(t.headers, t.rows); });
    assert.ok(csv.includes("'=SUM(A1)") && csv.includes("'-SN-9") && csv.includes("'+MAC1") && csv.includes("'@Supplier"), 'the export protects spreadsheet programs');
    await page.evaluate(async () => { const S = AccountApp.store; await S.commit({ deletes: S.all('item').map(e => ({ type: 'item', id: e.id })) }); });
    const rt = await give(csv); assert.match(rt.sheet, /2 devices will be added\./); await rt.go.click(); await page.waitForFunction(() => AccountApp.store.all('item').length === 2);
    got = await items();
    const pick = (d) => ({ uid: d.uid, serial: d.serial, mac: d.mac, cond: d.cond, supplier: d.supplier, shelf: d.custom?.shelf || '', make: d.make, model: d.model, cost: d.cost, price: d.price, status: d.status, receivedOn: d.receivedOn, notes: d.notes, steps: Object.keys(d.checks || {}).sort(), vals: d.checkVals || null, testedOn: d.testedOn || '', testNotes: d.testNotes || '' });
    const key = (a, b) => a.uid.localeCompare(b.uid);
    assert.deepEqual(got.map(pick).sort(key), origin.map(pick).sort(key), 'export then import returns every device field');

    // ---- a big account: 5,000 devices import in chunks within a minute, and every one is kept ----
    await page.evaluate(async () => { const S = AccountApp.store; await S.commit({ deletes: S.all('item').map(e => ({ type: 'item', id: e.id })) }); });
    const big = 'UID,Serial number,Make,Model,Cost,Price,Status,Notes\r\n' + Array.from({ length: 5000 }, (_, i) => `BIG-${i},SER-${i},Roku,Ultra,20.00,50.00,available,row ${i}`).join('\r\n');
    const t0 = Date.now(), b = await give(big); assert.match(b.sheet, /5000 devices will be added/); await b.go.click();
    await page.waitForFunction(() => AccountApp.store.all('item').length === 5000, null, { timeout: 120000 });
    assert.ok(Date.now() - t0 < 120000, 'the import finished in time'); assert.equal(new Set((await items()).map(d => d.uid)).size, 5000);
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
