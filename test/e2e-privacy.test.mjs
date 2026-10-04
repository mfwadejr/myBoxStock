// TEST / e2e-privacy — a real browser: export everything (a valid zip built in the page), per-customer export, erase a customer
// (sales stay), close the account and restore it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

// Minimal zip reader: finds every entry from the central directory and checks its CRC.
function readZip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), n = buf.readUInt16LE(end + 10); let p = buf.readUInt32LE(end + 16); const out = {};
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50); const size = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), off = buf.readUInt32LE(p + 42), crc = buf.readUInt32LE(p + 16), name = buf.toString('utf8', p + 46, p + 46 + nl);
    const lh = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), data = buf.subarray(lh, lh + size);
    if (zlib.crc32) assert.equal(zlib.crc32(data), crc, `CRC of ${name}`); out[name] = data.toString('utf8'); p += 46 + nl;
  }
  return out;
}

test('browser: export everything, customer export and erase, close and restore', { skip, timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1000 } }), page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Privacy Co'); await page.fill('#em', 'p@example.com'); await page.fill('#un', 'priya'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(), login = 'priya@' + id; await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');

    await page.evaluate(async () => {
      const [cid] = await AccountApp.store.commit({ puts: [{ type: 'customer', data: { name: 'Zed Buyer', phone: '555-0100', email: 'zed@example.com', notes: 'likes boxes', createdAt: Date.now() } }] });
      await AccountApp.store.commit({ puts: [{ type: 'sale', data: { no: 'S-TEST-0001', ts: Date.now(), customerId: cid, customerName: 'Zed Buyer', customerEmail: 'zed@example.com', items: [{ make: 'Roku', model: 'Ultra', uid: 'U-1', price: 5000 }], subtotal: 5000, total: 5000, cost: 2000, payment: 'cash' } }] });
    });

    // export everything
    await page.goto(srv.base + '/app/#/security'); await page.waitForSelector('#xall');
    let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xall')]);
    assert.match(dl.suggestedFilename(), /^myboxstock-privacy-co-\d{8}\.zip$/);
    let z = readZip(fs.readFileSync(await dl.path()));
    assert.deepEqual(Object.keys(z).sort(), ['README.txt', 'customers.csv', 'inventory.csv', 'sale_items.csv', 'sales.csv', 'settings.json']);
    assert.ok(z['customers.csv'].includes('Zed Buyer') && z['sales.csv'].includes('S-TEST-0001') && z['sale_items.csv'].includes('Roku Ultra') && JSON.parse(z['settings.json']).fields);

    // one customer: export, then erase
    await page.goto(srv.base + '/app/#/customers'); await page.waitForSelector('tr.click'); await page.click('tr.click'); await page.waitForSelector('#xp');
    [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xp')]); z = readZip(fs.readFileSync(await dl.path()));
    assert.ok(z['customer.csv'].includes('zed@example.com') && z['purchases.csv'].includes('S-TEST-0001'));
    await page.click('#era'); await page.fill('#tc', 'ERASE'); await page.click('#ok'); await page.waitForSelector('.scrim', { state: 'detached' }); await page.waitForSelector('.empty');
    assert.equal(await page.locator('tr.click').count(), 0, 'the customer is gone');
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click');
    const row = await page.textContent('tr.click'); assert.ok(row.includes('S-TEST-0001') && row.includes('Erased customer') && !row.includes('Zed') && row.includes('50.00'), row);
    const all = await page.evaluate(() => JSON.stringify(AccountApp.store.all('sale').map(s => s.data))); assert.ok(!all.includes('zed@example.com') && !all.includes('Zed Buyer'));

    // close and restore
    await page.goto(srv.base + '/app/#/security'); await page.waitForSelector('#close'); await page.click('#close');
    await page.fill('#cp', PW); await page.fill('#ci', id); await page.click('.sheet #go'); await page.waitForSelector('#cb');
    assert.match(await page.textContent('#cb'), /closing and will be erased on/);
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/closing.png` : '/tmp/closing.png' });
    await page.click('#cbr'); await page.waitForFunction(() => !document.querySelector('#cb')); assert.equal(await page.locator('#cb').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
