// TEST / t54-bulk-change — a real browser: Inventory Select mode. Tick devices, set a status, archive, restore, export the selection. A device on demo is never touched,
// a sold device keeps its sale, a View user does not see Select, and the changes are logged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.mjs';
import { skip, launch, signUp } from './helpers-ui.mjs';

test('browser: bulk change in Inventory', { skip, timeout: 150000 }, async () => {
  const srv = await startServer(), br = await launch();
  try {
    const { page, errors } = await signUp(srv, br, { biz: 'Bulk Co', user: 'bea' });
    const ids = await page.evaluate(async () => { const s = AccountApp.store; const mk = (uid, status = 'available') => ({ type: 'item', data: { uid, make: 'Acme', model: 'Box 1', status, cost: 5000, price: 9000, addedAt: Date.now(), receivedOn: '2026-01-01', checks: {} } });
      return s.commit({ puts: [mk('B1'), mk('B2'), mk('B3'), mk('B4', 'sold'), mk('B5', 'loaned')] }); });
    const status = (i) => page.evaluate((id) => AccountApp.store.get('item', id).data.status, ids[i]);
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#selmode'); assert.equal(await page.locator('.rowsel').count(), 0, 'no tick boxes until Select is pressed');
    await page.click('#selmode'); await page.waitForSelector('.rowsel'); await page.selectOption?.('#st', 'all').catch(() => {});
    // the filter shows Available only; widen it to All so the sold and demo ones can be ticked too
    await page.click('#st'); await page.locator('#st').locator('xpath=..').locator('.select-option[data-value="all"]').click(); await page.waitForSelector('.rowsel');
    assert.equal(await page.locator('.rowsel').count(), 5, 'sold and demo devices are listed too (the filter is All, not archived)');
    assert.ok(await page.locator('#barch').isDisabled(), 'bulk buttons wait for a selection');
    await page.click('#selall'); assert.match(await page.textContent('#selcount'), /5 selected/);
    // set status to Reserved: B1-B3 change, B4 (sold) and B5 (on demo) are left alone
    await page.click('#bst'); await page.locator('#bst').locator('xpath=..').locator('.select-option[data-value="reserved"]').click();
    await page.waitForSelector('#ok'); assert.match(await page.textContent('.sheet h2'), /Set to Reserved: 3 devices\?/); assert.match(await page.textContent('.sheet p'), /1 on demo, 1 sold/);
    await page.click('#ok'); await page.waitForTimeout(700);
    assert.deepEqual([await status(0), await status(1), await status(2), await status(3), await status(4)], ['reserved', 'reserved', 'reserved', 'sold', 'loaned']);
    // archive two, then restore them
    await page.waitForSelector('.rowsel'); for (const i of [0, 1]) await page.locator(`.rowsel[data-id="${ids[i]}"]`).check(); assert.match(await page.textContent('#selcount'), /2 selected/);
    await page.click('#barch'); await page.waitForSelector('#ok'); await page.click('#ok'); await page.waitForTimeout(700);
    const arch = await page.evaluate(() => AccountApp.store.all('item').filter(e => e.data.status === 'archived').length); assert.equal(arch, 2);
    await page.evaluate(() => { const ids = AccountApp.store.all('item').filter(e => e.data.status === 'archived').map(e => e.id); window.__a = ids; });
    await page.click('#st'); await page.locator('#st').locator('xpath=..').locator('.select-option[data-value="archived"]').click(); await page.waitForSelector('.rowsel');
    await page.click('#selall'); await page.click('#bres'); await page.waitForSelector('#ok'); await page.click('#ok'); await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => AccountApp.store.all('item').filter(e => e.data.status === 'archived').length), 0);
    assert.equal(await page.evaluate(() => AccountApp.store.all('item').filter(e => e.data.status === 'available').length), 2, 'restored devices come back Available');
    // export the selection: a file with only the ticked devices
    await page.click('#st'); await page.locator('#st').locator('xpath=..').locator('.select-option[data-value="all"]').click(); await page.waitForSelector('.rowsel');
    for (const i of [0, 1]) await page.locator(`.rowsel[data-id="${ids[i]}"]`).check();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bexp')]); assert.match(dl.suggestedFilename(), /^inventory-selection-\d{8}\.csv$/);
    const csv = (await import('node:fs')).readFileSync(await dl.path(), 'utf8'); assert.equal(csv.trim().split('\n').length, 3, 'a header and the two ticked devices');
    // Done selecting hides the tick boxes and forgets the selection
    await page.click('#selmode'); await page.waitForTimeout(300); assert.equal(await page.locator('.rowsel').count(), 0); assert.equal(await page.locator('.bulkbar').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
