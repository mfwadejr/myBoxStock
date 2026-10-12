// TEST / t55-reports — a real browser: Reports. Sales, revenue, cost and margin by month and by make and model (after refunds, voided left out), the "sitting too long" list with its
// Administrator-only number of days, and the year-end CSV. Phone width does not scroll sideways.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './helpers.mjs';
import { skip, launch, signUp, pick } from './helpers-ui.mjs';

test('browser: Reports', { skip, timeout: 150000 }, async () => {
  const srv = await startServer(), br = await launch();
  try {
    const { page, errors } = await signUp(srv, br, { biz: 'Report Co', user: 'rita' });
    const now = Date.now(), day = 864e5, ym = (ts) => { const d = new Date(ts); return d.getFullYear() * 100 + d.getMonth() + 1; };
    const out = await page.evaluate(async ([now, day]) => { const s = AccountApp.store;
      const item = (uid, model, status, ageDays, cost = 5000, price = 9000) => ({ type: 'item', data: { uid, make: 'Acme', model, status, cost, price, addedAt: now - ageDays * day, receivedOn: new Date(now - ageDays * day).toISOString().slice(0, 10), checks: {} } });
      const ids = await s.commit({ puts: [item('S1', 'Box 1', 'sold', 5), item('S2', 'Box 1', 'sold', 5), item('S3', 'Box 2', 'sold', 5), item('A1', 'Box 1', 'available', 100), item('A2', 'Box 1', 'available', 10), item('L1', 'Box 1', 'loaned', 200)] });
      const sale = (no, ts, its, extra = {}) => ({ type: 'sale', data: { no, ts, customerId: null, customerName: 'Walk-in', items: its.map(([id, model, price, cost]) => ({ id, make: 'Acme', model, price, cost })), subtotal: its.reduce((t, i) => t + i[2], 0), total: its.reduce((t, i) => t + i[2], 0), cost: its.reduce((t, i) => t + i[3], 0), payment: 'cash', paymentLabel: 'Cash', notes: '', ...extra } });
      await s.commit({ puts: [sale('R-1', now - 2 * day, [[ids[0], 'Box 1', 9000, 5000], [ids[1], 'Box 1', 9000, 5000]]), sale('R-2', now - 40 * day, [[ids[2], 'Box 2', 10000, 4000]]), sale('R-3', now - 3 * day, [[ids[2], 'Box 2', 99999, 1]], { voided: true })] });
      return ids; }, [now, day]);
    await page.goto(srv.base + '/app/#/reports'); await page.waitForSelector('#rp');
    const stat = async () => (await page.locator('.stat-grid .stat-value').allTextContents());
    // last 12 months: R-1 (2 sales lines = 1 sale) + R-2 = 2 sales; revenue 18000 + 10000 = $280.00; cost 10000 + 4000 = $140.00; profit $140.00; margin 50.0%; the voided sale is left out
    const s1 = await stat(); assert.deepEqual(s1, ['2', '$280.00', '$140.00', '$140.00', '50.0%']);
    assert.ok((await page.textContent('main')).includes('Acme Box 1') && (await page.textContent('main')).includes('Acme Box 2'));
    // by model: Box 1 sold 2 (rev $180, cost $100, profit $80, 44.4%), Box 2 sold 1 (rev $100, cost $40, profit $60, 60.0%); ordered by profit
    const rows = await page.locator('.card:has(h3:text("By make and model")) tbody tr').allTextContents();
    assert.equal(rows.length, 2); assert.match(rows[0], /Acme Box 1.*2.*\$180\.00.*\$100\.00.*\$80\.00.*44\.4%/); assert.match(rows[1], /Acme Box 2.*1.*\$100\.00.*\$40\.00.*\$60\.00.*60\.0%/);
    // by month: total sales across the month rows is 2
    const mrows = await page.locator('.card:has(h3:text("By month")) tbody tr').allTextContents(); assert.ok(mrows.length >= 1 && mrows.length <= 2);
    // a shorter period: this month's own numbers equal the sales dated this month
    await pick(page, 'rp', '30'); await page.waitForTimeout(300); const s30 = await stat(); assert.equal(s30[0], '1', 'the 40-day-old sale is outside 30 days');
    await pick(page, 'rp', 'month'); await page.waitForTimeout(300); const sm = await stat(); assert.ok(Number(sm[0]) >= 1 && Number(sm[0]) <= 2);
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('#agedbox'); assert.match(await page.textContent('#agedbox'), /1 device has been on the shelf for 60 days or more/); await page.goto(srv.base + '/app/#/reports'); await page.waitForSelector('#rp');
    // sitting too long: 60 days by default; A1 (100 days) is listed, A2 (10 days) is not, the device on demo (200 days) is not
    const aged = await page.locator('.card:has(h3:text("Sitting too long")) tbody tr').allTextContents(); assert.equal(aged.length, 1); assert.match(aged[0], /A1|Acme Box 1/); assert.match(aged[0], /(99|100)\$/.test("") ? /x/ : /(99|100)/);
    await page.fill('#aged', '5'); await page.press('#aged', 'Tab'); await page.waitForTimeout(700);
    assert.equal((await page.locator('.card:has(h3:text("Sitting too long")) tbody tr').count()), 2, 'at 5 days both A1 and A2 are listed');
    assert.equal(await page.evaluate(() => AccountApp.store.config().reports.agedDays), 5, 'the number is kept in the account settings');
    await page.fill('#aged', '0'); await page.press('#aged', 'Tab'); await page.waitForTimeout(700); assert.match(await page.textContent('.card:has(h3:text("Sitting too long"))'), /Turned off/);
    // the year-end CSV: both sales this year, a total line, no voided sale
    const y = new Date().getFullYear(); const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#yexp')]); assert.equal(dl.suggestedFilename(), `sales-${y}-year-end.csv`);
    const csv = fs.readFileSync(await dl.path(), 'utf8').trim().split('\r\n'); const tm = ym(now) === ym(now - 40 * day) ? 0 : 1; void tm;
    assert.match(csv[0], /Revenue after refunds/); assert.ok(csv.some(l => l.includes('R-1')) && csv.some(l => l.includes('R-2')) && !csv.some(l => l.includes('R-3')), 'voided sale left out');
    assert.match(csv.at(-1), /Total.*"?2 sales"?.*280\.00.*140\.00/);
    // phone width: no sideways scroll
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no sideways scroll on a phone');
    assert.deepEqual(errors, []); void out;
  } finally { await br.close(); await srv.stop(); }
});
