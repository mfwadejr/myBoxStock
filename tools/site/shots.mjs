// TOOLS / site / shots — makes the marketing-site screenshots of the reseller app from FAKE data only.
// Usage: node tools/site/shots.mjs <output-dir>
// Starts the app from this checkout on a throw-away data folder, signs up a made-up business, fills it with made-up stock, customers, sales and team,
// then saves laptop (1280x800) and phone (390x844) screenshots with a headless Chromium (CHROMIUM_PATH, default /opt/pw-browsers/chromium).
import fs from 'node:fs';
import path from 'node:path';
import { startServer, fillLogin, Client } from '../../test/helpers.mjs';
import { CAMERA_INIT, dataUrl, aim } from '../../test/helpers-scan.mjs';

const out = path.resolve(process.argv[2] || 'shots'), exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); }
const PW = 'Sup3rSecretPass!', TEMP = 'Temp-pass-12345';
const SIZES = { laptop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
fs.mkdirSync(out, { recursive: true });

const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
try {
  // switch the request limiter off: this is a throw-away server
  const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });

  const ctx = await br.newContext({ viewport: SIZES.laptop, deviceScaleFactor: 1.5 }); await ctx.addInitScript(CAMERA_INIT);
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
  await page.fill('#bn', 'Harbor Streaming Supply'); await page.fill('#em', 'owner@example.com'); await page.fill('#un', 'maya'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(); await page.click('#go');
  await fillLogin(page, 'maya@' + id); await page.fill('#p', PW); await page.click('button.block');
  await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.main');

  // ---- fake data ----
  await page.evaluate(async () => {
    const S = AccountApp.store, C = AccountApp.commerce, DAY = 864e5, now = Date.now();
    const cfg = S.config(), steps = C.steps();
    const MODELS = [['Roku', 'Ultra 4800', 2800, 5900], ['Amazon', 'Fire TV Stick 4K', 2200, 4500], ['Google', 'Chromecast with Google TV', 2500, 5200], ['Apple', 'Apple TV 4K', 9000, 14900], ['Nvidia', 'Shield TV Pro', 12000, 19900], ['Onn', '4K Streaming Box', 1500, 3400]];
    const items = []; let n = 0;
    for (const [mi, [make, model, cost, price]] of MODELS.entries()) for (let k = 0; k < 7 - (mi % 3); k++) {
      n++; const uid = `${make.slice(0, 2).toUpperCase()}${String(48200 + n * 37)}`, tested = k % 4 !== 3;
      const checks = {}; if (tested) steps.forEach((s, si) => { if (k % 4 !== 2 || si < 2) checks[s.key] = { by: 'maya', at: now - (k + 2) * DAY }; });
      items.push({ id: Vault.newId(), data: { uid, serial: `SN${String(7700000 + n * 913)}`, mac: `A0:BB:3E:19:${(n * 7).toString(16).toUpperCase().padStart(2, '0')}:${(n * 13).toString(16).toUpperCase().padStart(2, '0')}`, make, model, condition: k % 3 === 0 ? 'New' : 'Refurbished', supplier: ['Lakeside Wholesale', 'Pine Ridge Traders'][k % 2], status: 'available', cost, price, addedAt: now - (20 - k) * DAY, receivedAt: now - (20 - k) * DAY, checks } });
    }
    items.push({ id: Vault.newId(), data: { uid: '273D00000019CE1A', serial: 'V6PLY5260919CE1A', mac: 'A0:BB:3E:19:CE:1A', make: 'Onn', model: '4K Streaming Box', condition: 'New', supplier: 'Lakeside Wholesale', status: 'available', cost: 1500, price: 3400, addedAt: now - 2 * DAY, receivedAt: now - 2 * DAY, checks: Object.fromEntries(steps.map(s => [s.key, { by: 'maya', at: now - DAY }])) } });
    const customers = ['Priya Raman', 'Daniel Okafor', 'Sofia Lindqvist', 'Marcus Webb', 'Hannah Kowalski', 'Tomas Herrera', 'Grace Nakamura', 'Oliver Banks'].map((name, i) => ({ id: Vault.newId(), data: { name, phone: '', email: '', notes: ['Prefers pickup', 'Buys for a small cafe', 'Repeat customer', '', 'Referred by Priya', '', 'Asked about bulk pricing', ''][i], createdAt: now - (30 - i) * DAY } }));
    const puts = [...customers.map(c => ({ type: 'customer', id: c.id, data: c.data })), ...items.map(i => ({ type: 'item', id: i.id, data: i.data }))];
    await S.commit({ puts });
    // sales: sell some of the tested devices
    const pay = C.paymentLabel ? null : null, sales = [], sold = [];
    const plan = [[0, [0]], [1, [1, 2]], [2, [8]], [4, [9, 10]], [5, [15]], [9, [3]], [12, [16, 17, 18]], [16, [22]], [20, [23, 4]]];
    plan.forEach(([ago, idx], si) => {
      const cust = customers[si % customers.length], when = now - ago * DAY - si * 3600e3, saleId = Vault.newId();
      const lines = idx.map(ix => items[ix]).filter(it => !sold.includes(it.id));
      if (!lines.length) return; lines.forEach(it => sold.push(it.id));
      const rows = lines.map((it, li) => { const pct = si === 6 && li === 0 ? 10 : 0, price = C.lineNet(it.data.price, pct); return { id: it.id, uid: it.data.uid, serial: it.data.serial, mac: it.data.mac, make: it.data.make, model: it.data.model, fields: C.fieldSnapshot(it.data), inspection: C.inspectionSnapshot(it.data), listPrice: it.data.price, pct, price, cost: it.data.cost }; });
      const sub = rows.reduce((t, r) => t + r.price, 0), payment = ['cash', 'card', 'zelle'][si % 3];
      sales.push({ type: 'sale', id: saleId, data: { no: C.newReceiptNo(when), ts: when, customerId: cust.id, customerName: cust.data.name, customerEmail: '', items: rows, subtotal: sub, orderPct: 0, orderOff: 0, total: sub, cost: rows.reduce((t, r) => t + r.cost, 0), payment, warranty: C.warrantySnapshot((C.warrantyPeriods().find(p => !p.archived && p.amount >= 90) || C.warrantyPeriods().find(p => !p.archived && p.amount) || {}).key, when) } });
      lines.forEach(it => sales.push({ type: 'item', id: it.id, data: { ...it.data, status: 'sold', soldAt: when, saleId } }));
    });
    await S.commit({ puts: sales });
    // a couple of devices still being tested or reserved, to show the status chips
    const keep = S.all('item').filter(e => e.data.status === 'available');
    await S.commit({ puts: [{ type: 'item', id: keep[3].id, data: { ...keep[3].data, status: 'reserved' } }, { type: 'item', id: keep[6].id, data: { ...keep[6].data, status: 'returned' } }] });
  });
  // team
  await page.evaluate(async (TEMP) => { for (const [username, role] of [['jordan', 'Standard'], ['riley', 'View'], ['sam', 'Administrator']]) await AccountApp.api('POST', '/users', { username, email: '', role, password: TEMP, keys: await Vault.keysFor(TEMP, AccountApp.vault.adk) }); }, TEMP);
  const backupText = await page.evaluate(async () => (await AccountApp.backupEngine.makeFile()).text);

  await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#tk'); await page.setViewportSize(SIZES.laptop);
  { const dl = page.waitForEvent('download'); await page.locator('.main .btn:has-text("Back up now")').first().click(); await dl.catch(() => {}); await page.waitForTimeout(1500); await page.evaluate(() => document.querySelector('.toasts')?.remove()); }
  const go = async (hash, sel = '.main h1') => { await page.goto(srv.base + '/app/#/' + hash); await page.waitForSelector(sel); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500); };
  const shot = async (name, size, opts = {}) => { await page.evaluate(() => document.querySelector('.toasts')?.remove()); await page.screenshot({ path: path.join(out, `${name}-${size}.png`), ...opts }); };

  const closeSheet = async () => { await page.evaluate(() => document.querySelector('.sheet [data-cancel], .sheet #done')?.click()); await page.waitForSelector('.scrim', { state: 'detached' }).catch(() => {}); await page.waitForTimeout(300); };
  for (const size of ['laptop', 'phone']) {
    await page.setViewportSize(SIZES[size]);
    await go('home'); await shot('home', size);
    await go('inventory', '.main table, .main .card'); await shot('inventory', size);
    // quick sale with two devices in the cart and a customer picked
    await go('sell', '#scan');
    const avail = await page.evaluate(() => AccountApp.store.all('item').filter(e => e.data.status === 'available').slice(0, 2).map(e => e.data.serial));
    if (!await page.locator('.cart-line').count()) for (const s of avail) { await page.fill('#scan', s); await page.press('#scan', 'Enter'); await page.waitForTimeout(200); }
    if (await page.locator('#cs').count()) { await page.fill('#cs', 'Priya'); await page.waitForSelector('#cl li'); await page.click('#cl li'); } await page.waitForTimeout(300);
    await page.evaluate((phone) => { if (phone) document.querySelector('#cart')?.scrollIntoView(); }, size === 'phone'); await page.waitForTimeout(200); await shot('quick-sale', size);
    await go('customers'); await shot('customers', size);
    await go('sales', '.main table, .main .card'); await page.waitForTimeout(300);
    await page.locator('.main tbody tr, .main .rowcard, .main [data-sale]').first().click().catch(() => {}); await page.waitForSelector('.receipt, .sheet', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400);
    if (size === 'laptop') await page.locator('.sheet input[type=checkbox]').first().check().catch(() => {}); await page.waitForTimeout(300);
    await shot('sales-receipt', size);
    await closeSheet();
    await go('team'); await shot('team', size);
    await go('settings'); await shot('settings', size);
    // backup and restore: run Test a backup file on a real file
    await go('backup', '#tk'); if (size === 'laptop') await page.setViewportSize({ width: 1280, height: 1000 });
    await page.setInputFiles('#tf', { name: 'harbor-backup.mbsbackup', mimeType: 'application/octet-stream', buffer: Buffer.from(backupText) }); await page.waitForSelector('.sheet #sm'); await page.waitForSelector('.toast', { state: 'detached' }).catch(() => {}); await page.waitForTimeout(600);
    await shot('backup-test', size);
    await closeSheet(); await page.setViewportSize(SIZES[size]); await page.waitForTimeout(300);
    await shot('backup', size);
  }
  // scanner overlay (phone)
  await page.setViewportSize(SIZES.phone);
  await page.goto(srv.base + '/app/#/sell'); await page.waitForSelector('#scan'); await page.evaluate(() => { AccountApp.scanner.engine = 'zxing'; });
  await page.click('.scanbtn'); await page.waitForSelector('.scanner');
  await aim(page, dataUrl('label-single.jpg'), 385, 628, 0.85);
  await page.waitForSelector('.scanner[data-state=got]', { timeout: 15000 }); await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.toasts')?.remove()); await page.screenshot({ path: path.join(out, 'scanner-phone.png') });
  console.log('done', fs.readdirSync(out).join(' '));
} finally { await br.close(); srv.stop(); }
