// TOOLS / docs-shots / manifest-reseller — the screenshots used by the reseller documentation (content/docs/reseller). The runner (tools/docs-shots/run.mjs) reads this list,
// signs in to the Demo3 set (made-up data only) as the role named in each entry, opens `route`, runs `prep` and saves public/assets/docs/<name>-laptop.png and <name>-phone.png.
//
//   name      reseller-<page-slug>[-<n>], matching the shot: line on the page
//   set       'reseller'
//   role      'Owner' (default: the Demo3 Administrator), 'Standard' or 'View'
//   route     the hash route to open first
//   prep      optional async (page, h) to click, scroll, fill or open a sheet before the picture is taken. The runner keeps one signed-in page per role and size, so every prep
//             first closes anything the previous one left open (see P). A prep saves nothing except the small made-up "sample deliveries" the helper `seed` adds to the
//             demo account (once, and only to made-up demo records), and a made-up return on a demo sale.
//   keepScroll  true when the prep scrolls to a card and the runner must not scroll back to the top
//   viewport  'both' = laptop and phone
//
// Every prep only uses `page` (Playwright) and the helpers in this file, so it does not depend on the runner's own helper object `h`.

const sleep = (page, ms = 450) => page.waitForTimeout(ms);
const pick = async (page, id, value) => { await page.click('#' + id); await page.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${value}"]`).click(); };
// Scrolls the heading of a card to near the top so the picture shows that card.
const toCard = async (page, title) => { const h = page.locator('h3', { hasText: title }).first(); await h.waitFor(); await h.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -90)); await sleep(page); };
const go = async (page, hash, ready) => { await page.evaluate((x) => { location.hash = x; }, hash); await page.waitForSelector(ready); await sleep(page, 350); };
// One manifest entry. The runner reuses one signed-in page per role and size, so the prep first closes any sheet or menu the previous shot left open.
const E = (name, route, prep, extra = {}) => ({ name, set: 'reseller', route, viewport: 'both', ...extra,
  prep: async (page, h) => { for (let i = 0; i < 3; i++) await page.keyboard.press('Escape'); await sleep(page, 250); return prep(page, h); } });

// Made-up sample data, added once: five recent sales get a delivery (three To ship, one Shipped, one Meet) and the buyers get a saved address. Safe to run again.
async function seed(page) {
  await page.evaluate(async () => {
    const A = AccountApp, S = A.store; await S.load();
    const sales = S.all('sale').filter(e => !e.data.voided && e.data.customerId && !(e.data.returns || []).length).sort((a, b) => b.data.ts - a.data.ts);
    if (S.all('sale').some(e => e.data.delivery?.type === 'shipping')) return;
    const towns = [['Maple Street', 'Columbus', 'OH', '43215'], ['Harbor Road', 'Dayton', 'OH', '45402'], ['Oak Avenue', 'Austin', 'TX', '78701'], ['Pine Court', 'Denver', 'CO', '80203'], ['Lake Drive', 'Madison', 'WI', '53703']];
    const seen = new Set(), puts = [];
    sales.filter(e => (seen.has(e.data.customerId) ? false : (seen.add(e.data.customerId), true))).slice(0, 5).forEach((e, i) => {
      const [street, city, state, zip] = towns[i], c = S.get('customer', e.data.customerId); if (!c) return;
      const addr = { name: c.data.name, street: `${10 + i * 7} ${street}`, unit: i === 1 ? 'Apt 4B' : '', city, state, zip, country: '' };
      puts.push({ type: 'customer', id: c.id, data: { ...c.data, address: addr } });
      const base = { shipTo: addr, fee: 899, cost: 640, carrier: '', tracking: '', note: '', status: 'toship', shippedAt: 0, labelRef: '' };
      const delivery = i < 3 ? { type: 'shipping', ...base, note: i === 0 ? 'Fragile, leave at the door' : '' }
        : i === 3 ? { type: 'shipping', ...base, status: 'shipped', shippedAt: Date.now() - 864e5, carrier: 'USPS', tracking: '9400 1000 0000 0000 0000 00' }
          : { type: 'meet', date: '', notes: 'Library car park, 5pm' };
      puts.push({ type: 'sale', id: e.id, data: { ...e.data, delivery } });
    });
    if (puts.length) await S.commit({ puts });
    const cfg = S.config();   // a made-up return address so the label preview looks complete
    await S.saveConfig({ ...cfg, label: { ...(cfg.label || {}), returnAddress: { name: 'Demo3 Streaming', street: '100 Example Street', unit: '', city: 'Springfield', state: 'IL', zip: '62701', country: '' } } });
  });
}
// Receipt number of the first sale that matches a test run inside the page (returns '' if none).
const saleNo = (page, fn) => page.evaluate((src) => { const f = new Function('d', 'return (' + src + ')(d)'); const e = AccountApp.store.all('sale').filter(x => !x.data.voided).sort((a, b) => b.data.ts - a.data.ts).find(x => f(x.data)); return e ? e.data.no : ''; }, fn.toString());
// The Sales page remembers its filters while the app stays open, so go back to all deliveries first.
const salesAll = async (page) => { await go(page, '#/sales', '#sdl'); await pick(page, 'sdl', ''); if (await page.locator('#clr').count()) await page.click('#clr'); await sleep(page, 300); };
const openSale = async (page, no) => { await salesAll(page); await page.fill('#q', no); await sleep(page, 700); await page.locator('tr.click').first().click(); await page.waitForSelector('.receipt'); await sleep(page); };
const toShipNo = (page) => saleNo(page, (d) => d.delivery?.type === 'shipping' && d.delivery.status === 'toship');
const plain2 = (d) => (!d.delivery || d.delivery.type === 'immediate') && (d.items || []).length >= 2 && !(d.returns || []).length;

export default [
  // ---- Getting started ------------------------------------------------------------------------------------------------------------------------------------------------
  // Home with the Get set up card at the top (it shows until every step is done; the Owner login has not saved a recovery key or tested a backup).
  E('reseller-getting-started-1', '#/home', async (page) => { await page.waitForSelector('.stat-grid'); await sleep(page, 600); }),
  // The Documentation page: contents, search box and the open topic.
  E('reseller-getting-started-2', '#/docs', async (page) => { await page.waitForSelector('.doc-layout'); await sleep(page, 600); }),
  // The account menu opened from the button with the username.
  E('reseller-getting-started-3', '#/home', async (page) => { await page.waitForSelector('#acct button'); await page.click('#acct button'); await page.waitForSelector('[role=menu], .menu'); await sleep(page); }),

  // ---- Home -----------------------------------------------------------------------------------------------------------------------------------------------------------
  E('reseller-home-1', '#/home', async (page) => { await page.waitForSelector('.stat-grid'); await sleep(page, 600); }),
  // Makes three made-up models look low so the Running low card has rows (one at its reorder level, two a little above), then shows the card.
  E('reseller-home-2', '#/home', async (page) => {
    await page.evaluate(async () => {
      const A = AccountApp, S = A.store, C = A.commerce, items = S.all('item'), puts = [];
      const left = (name) => items.filter(e => e.data.model === name && C.isAvail(e.data)).length;
      S.all('model').map(m => ({ m, n: left(m.data.name) })).filter(x => x.n > 0).sort((a, b) => a.n - b.n).slice(0, 3).forEach(({ m, n }, i) => puts.push({ type: 'model', id: m.id, data: { ...m.data, reorder: n + (i === 0 ? 0 : i === 1 ? 2 : 6) } }));
      if (puts.length) await S.commit({ puts });
      try { localStorage.removeItem(`mbs.lowcard.${A.me?.id || 'me'}`); } catch { /* ignore */ }
    });
    await go(page, '#/inventory', 'tr.click'); await go(page, '#/home', '.stat-grid'); await page.waitForSelector('#lowbox'); await page.locator('#lowbox').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -70)); await sleep(page);
  }, { keepScroll: true }),

  // ---- Inventory ------------------------------------------------------------------------------------------------------------------------------------------------------
  E('reseller-inventory-1', '#/inventory', async (page) => { await page.waitForSelector('tr.click'); await sleep(page, 500); }),
  E('reseller-inventory-2', '#/inventory', async (page) => { await page.waitForSelector('#add'); await page.click('#add'); await page.waitForSelector('.sheet'); await sleep(page); }),   // the Add device sheet
  E('reseller-inventory-3', '#/inventory', async (page) => { await page.waitForSelector('tr.click'); await toCard(page, 'Stock levels'); }, { keepScroll: true }),   // Stock levels with Reorder at

  // ---- Quick sale -----------------------------------------------------------------------------------------------------------------------------------------------------
  // Two devices in the cart. (The sale screen keeps its cart while the page stays open, so a device is only added when the cart is empty.)
  E('reseller-quick-sale-1', '#/sell', async (page) => {
    await page.waitForSelector('#scan');
    if (!(await page.locator('.cart-line').count())) {
      const uids = await page.evaluate(() => AccountApp.store.all('item').filter(e => AccountApp.commerce.isAvail(e.data)).slice(0, 2).map(e => e.data.uid || e.data.serial));
      for (const u of uids) { await page.fill('#scan', u); await page.press('#scan', 'Enter'); await page.waitForFunction((n) => document.querySelectorAll('.cart-line').length >= n, uids.indexOf(u) + 1); }
    }
    await sleep(page);
  }),
  // The Delivery drop-down on Shipping, with Ship to filled from the customer's saved address.
  E('reseller-quick-sale-2', '#/sell', async (page) => {
    await seed(page); await go(page, '#/sell', '#scan');
    if (!(await page.locator('.cart-line').count())) {
      const uid = await page.evaluate(() => { const e = AccountApp.store.all('item').find(x => AccountApp.commerce.isAvail(x.data)); return e.data.uid || e.data.serial; });
      await page.fill('#scan', uid); await page.press('#scan', 'Enter'); await page.waitForSelector('.cart-line');
    }
    const name = await page.evaluate(() => AccountApp.store.all('customer').find(c => c.data.address?.street).data.name);
    await page.click('[data-mode=existing]'); await page.fill('#cs', name.split(' ')[0]); await page.locator('#cl li').first().click();
    await pick(page, 'dlv', 'shipping'); await page.waitForSelector('#dbox');
    await page.fill('#dfee', '8.99'); await page.fill('#dcost', '6.40'); await page.fill('#dcar', 'USPS'); await page.fill('#dnote', 'Fragile, leave at the door');
    await page.locator('#dbox').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -130)); await sleep(page);
  }, { keepScroll: true }),

  // ---- Delivery and shipping ------------------------------------------------------------------------------------------------------------------------------------------
  // The To ship list on Sales, with Print label and Mark shipped on each row.
  E('reseller-delivery-and-shipping-1', '#/sales', async (page) => {
    await seed(page); await go(page, '#/sales', 'tr.click'); await pick(page, 'sdl', 'toship'); await page.waitForSelector('[data-shipped]'); await sleep(page);
  }),
  // The Mark shipped form with a carrier and tracking number typed in.
  E('reseller-delivery-and-shipping-2', '#/sales', async (page) => {
    await seed(page); await go(page, '#/sales', 'tr.click'); await pick(page, 'sdl', 'toship'); await page.waitForSelector('[data-shipped]');
    await page.locator('[data-shipped]').first().click(); await page.waitForSelector('.sheet #scar'); await page.fill('.sheet #scar', 'USPS'); await page.fill('.sheet #str', '9400 1000 0000 0000 0000 00'); await sleep(page);
  }),
  // A shipped sale: the Delivery section with the tracking number and Copy.
  E('reseller-delivery-and-shipping-3', '#/sales', async (page) => {
    await seed(page); const no = await saleNo(page, (d) => d.delivery?.status === 'shipped'); await openSale(page, no); await page.locator('.delivery-detail').scrollIntoViewIfNeeded(); await sleep(page);
  }, { keepScroll: true }),

  // ---- Shipping labels ------------------------------------------------------------------------------------------------------------------------------------------------
  // The label preview with its Size, Style and Logo choices.
  E('reseller-shipping-labels-1', '#/sales', async (page) => {
    await seed(page); const no = await toShipNo(page); await openSale(page, no); await page.click('#dlabel'); await page.waitForSelector('.label'); await sleep(page, 700);
  }),
  E('reseller-shipping-labels-2', '#/settings', async (page) => { await page.waitForSelector('#drdn'); await toCard(page, 'Delivery and labels'); }, { keepScroll: true }),

  // ---- Customers ------------------------------------------------------------------------------------------------------------------------------------------------------
  E('reseller-customers-1', '#/customers', async (page) => { await page.waitForSelector('tr.click'); await sleep(page, 500); }),
  // Search by a receipt number: the result count and the clear button show.
  E('reseller-customers-2', '#/customers', async (page) => {
    await seed(page); const no = await saleNo(page, (d) => d.delivery?.type === 'shipping'); await go(page, '#/customers', '#q');
    await page.fill('#q', no); await sleep(page, 700); await page.waitForSelector('#qclear'); await sleep(page);
  }),
  // One customer: the saved address and every sale and shipment in one place.
  E('reseller-customers-3', '#/customers', async (page) => {
    await seed(page); await go(page, '#/customers', 'tr.click'); const clr = page.locator('#cclr'); if (await clr.count()) await clr.click();
    await page.click('[data-chip=addr]'); await sleep(page, 500); await page.locator('tr.click').first().click(); await page.waitForSelector('.sheet'); await sleep(page, 400);
    await page.locator('.sheet').getByText('Purchases and shipments').first().scrollIntoViewIfNeeded(); await sleep(page, 400);   // scroll the sheet down to the history
  }),

  // ---- Sales ----------------------------------------------------------------------------------------------------------------------------------------------------------
  E('reseller-sales-1', '#/sales', async (page) => { await seed(page); await salesAll(page); await sleep(page, 500); }),   // the list, with Delivery tags
  E('reseller-sales-2', '#/sales', async (page) => { await seed(page); const no = await saleNo(page, plain2); await openSale(page, no); }),   // a receipt with its buttons

  // ---- Returns and refunds --------------------------------------------------------------------------------------------------------------------------------------------
  // The Return or refund sheet with one device ticked.
  E('reseller-returns-and-refunds-1', '#/sales', async (page) => {
    await seed(page); const no = await saleNo(page, plain2); await openSale(page, no); await page.click('#ret'); await page.waitForSelector('.ret-line');
    await page.locator('[data-pick]').first().check(); await sleep(page, 600);
  }),
  // The credit note (refund receipt). Records one made-up return on a demo sale the first time it runs.
  E('reseller-returns-and-refunds-2', '#/sales', async (page) => {
    await seed(page); const done = await saleNo(page, (d) => (d.returns || []).length > 0);
    if (done) { await openSale(page, done); await page.locator('[data-cn]').first().click(); }
    else { const no = await saleNo(page, plain2); await openSale(page, no); await page.click('#ret'); await page.waitForSelector('.ret-line'); await page.locator('[data-pick]').first().check(); await page.click('#rgo'); }
    await page.waitForSelector('#cn'); await sleep(page, 600);
  }),

  // ---- Team -----------------------------------------------------------------------------------------------------------------------------------------------------------
  E('reseller-team-1', '#/team', async (page) => { await page.waitForSelector('#add'); await sleep(page, 500); }),
  E('reseller-team-2', '#/team', async (page) => { await page.waitForSelector('#add'); await page.click('#add'); await page.waitForSelector('.sheet #u'); await sleep(page); }),   // the Add person sheet
  E('reseller-team-3', '#/sales', async (page) => { await page.waitForSelector('tr.click'); await sleep(page, 500); }, { role: 'Standard' }),   // a Standard user: shorter menu, no Team or Settings
  E('reseller-team-4', '#/inventory', async (page) => { await page.waitForSelector('tr.click'); await sleep(page, 500); }, { role: 'View' }),   // a View user: look, no changes

  // ---- Settings -------------------------------------------------------------------------------------------------------------------------------------------------------
  E('reseller-settings-1', '#/settings', async (page) => { await page.waitForSelector('#save'); await sleep(page, 500); }),
  E('reseller-settings-2', '#/settings', async (page) => { await page.waitForSelector('#rtfm'); await toCard(page, 'Returns and refunds'); }, { keepScroll: true }),

  // ---- Backup and restore, Activity, Security, Support -----------------------------------------------------------------------------------------------------------------
  E('reseller-backup-and-restore-1', '#/backup', async (page) => { await page.waitForSelector('#mk'); await sleep(page, 500); }),
  E('reseller-activity-1', '#/activity', async (page) => { await page.waitForSelector('#act'); await sleep(page, 600); }),
  E('reseller-security-1', '#/security', async (page) => { await page.waitForSelector('.page-head'); await sleep(page, 600); }),
  E('reseller-support-1', '#/support', async (page) => { await page.waitForSelector('.page-head'); await sleep(page, 600); }),
  E('reseller-support-2', '#/support/new', async (page) => { await page.waitForSelector('#go'); await sleep(page, 600); }),
];
