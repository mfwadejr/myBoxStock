// Marketing-site screenshots (made from the same Demo mode data). Run: node tools/docs-shots/run.mjs --manifest site --out <folder>
// then node tools/site/build.mjs <site folder> <folder>. The names are the ones tools/site/src/content.mjs uses.
// The plan chip in the top bar and the backup reminder are taken off the page first (the site makes no plan or pricing claims).
const tidy = async (page) => {
  await page.evaluate(() => { document.querySelectorAll('.topbar .chip').forEach(c => c.remove()); });
  await page.locator('button:has-text("Not today")').first().click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(250);
};
const cartWithCustomer = async (page, h) => {
  const serials = await page.evaluate(() => AccountApp.store.all('item').filter(e => e.data.status === 'available').slice(0, 2).map(e => e.data.serial));
  if (!await page.locator('.cart-line').count()) for (const s of serials) { await page.fill('#scan', s); await page.press('#scan', 'Enter'); await page.waitForTimeout(250); }
  const name = await page.evaluate(() => AccountApp.store.all('customer')[0]?.data.name || '');
  if (name && await page.locator('#cs').count()) { await page.fill('#cs', name.split(' ')[0]); await page.waitForSelector('#cl li'); await page.click('#cl li'); }
  await page.waitForTimeout(300);
};
const pick = async (page, btn, value) => { await page.click(btn); await page.click(`.select-list [data-value="${value}"]`); await page.waitForTimeout(300); };

export default [
  { name: 'home', set: 'reseller', route: '#/home', prep: tidy },
  { name: 'inventory', set: 'reseller', route: '#/inventory', prep: tidy },
  { name: 'quick-sale', set: 'reseller', route: '#/sell', prep: async (page, h) => { await tidy(page); await cartWithCustomer(page, h); if (h.size === 'phone') await h.scrollTo('#pay'); }, keepScroll: true },
  { name: 'delivery', set: 'reseller', route: '#/sell', keepScroll: true, prep: async (page, h) => { await tidy(page); await cartWithCustomer(page, h); await pick(page, '#dlv', 'shipping'); await h.scrollTo('#dlv'); await h.wait(300); } },
  { name: 'returns', set: 'reseller', route: '#/sales', prep: async (page, h) => { await tidy(page); await page.locator('tr.click').first().click(); await page.waitForSelector('#ret'); await page.click('#ret'); await page.waitForSelector('.sheet'); await page.locator('.sheet input[type=checkbox]').first().check().catch(() => {}); await h.wait(500); } },
  { name: 'customers', set: 'reseller', route: '#/customers', prep: tidy },
  { name: 'sales', set: 'reseller', route: '#/sales', prep: tidy },
  { name: 'team', set: 'reseller', route: '#/team', prep: tidy },
  { name: 'backup', set: 'reseller', route: '#/backup', prep: tidy },
];
