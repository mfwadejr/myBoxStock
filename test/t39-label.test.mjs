// TEST / t39-label — a real browser: Print label on Shipping sales, label contents and privacy, three sizes with print rules, Themed and Plain, logo choices,
// per-label overrides, batch printing, reprint with tracking, Settings fields, backup round trip, phone layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', LOGO = 'data:image/png;base64,' + PNG;
const ROOT = path.resolve(import.meta.dirname, '..');

test('print rules: each label size has its own page size, and the plain style is pure black on white', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/css/commerce.css'), 'utf8'), tok = fs.readFileSync(path.join(ROOT, 'public/css/tokens.css'), 'utf8');
  assert.match(css, /@page label4x6 \{ size: 4in 6in; margin: 0; \}/); assert.match(css, /@page labelhalf \{ size: 8\.5in 5\.5in; margin: 0; \}/); assert.match(css, /@page labelletter \{ size: 8\.5in 11in; margin: 0; \}/);
  assert.match(css, /\.label\.size-4x6[^}]*page: label4x6/); assert.match(css, /\.label\.size-half[^}]*page: labelhalf/); assert.match(css, /\.label\.size-letter[^}]*page: labelletter/);
  assert.match(css, /break-after: page/); assert.match(tok, /--color-label-ink: #000000/); assert.match(css, /\.style-plain \.label-logo \{ filter: var\(--label-plain-filter\)/);
  assert.doesNotMatch(css, /barcode|qr/i, 'no barcode or QR styling');
});

test('browser: shipping labels', { skip, timeout: 280000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const pick = async (id, value) => { await page.click('#' + id); await page.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${value}"]`).click(); };
  const closeAll = async () => { for (let i = 0; i < 4 && await page.locator('.sheet').count(); i++) { await page.locator('.sheet [data-cancel]').last().click(); await page.waitForTimeout(350); } };
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Label Co'); await page.fill('#em', 'l@example.com'); await page.fill('#un', 'lia'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'lia@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    const ids = await page.evaluate(async (logo) => {
      const A = AccountApp, S = A.store, mk = (no, delivery, extra = {}) => ({ type: 'sale', data: { no, ts: Date.now() - 1000, customerId: null, customerName: 'Pat Doe', items: [{ id: 'x', make: 'Roku', model: 'Ultra', uid: 'U1', listPrice: 10000, pct: 0, price: 10000, cost: 4000 }], subtotal: 10000, orderPct: 0, orderOff: 0, total: 10000, cost: 4000, payment: 'cash', paymentLabel: 'Cash', warranty: { key: 'none', label: 'No warranty', start: 0, end: null }, notes: '', ...(delivery ? { delivery } : {}), ...extra } });
      const to = { name: 'Jordan Ellis', street: '2418 Maple Grove Lane', unit: 'Apt 3B', city: 'Columbus', state: 'OH', zip: '43215', country: '' };
      const ship = { type: 'shipping', shipTo: to, fee: 900, cost: 612, carrier: '', tracking: '', note: '', status: 'toship', shippedAt: 0, labelRef: '' };
      const r = await S.commit({ puts: [mk('S-IMM-1'), mk('S-SHIP-1', ship), mk('S-SHIP-2', { ...ship, note: 'Fragile, leave at the door', shipTo: { ...to, name: 'Casey Lane' } }), mk('S-MEET-1', { type: 'meet', date: '', notes: 'x' })] });
      await S.saveConfig({ ...S.config(), mail: { ...S.config().mail, logo }, label: { size: '4x6', look: 'themed', logo: 'business', customLogo: '', returnAddress: { name: 'Sample Streaming Co.', street: '100 Example Street', unit: 'Suite 4', city: 'Hagerstown', state: 'MD', zip: '21740', country: 'United States' } } });
      return { imm: r[0], s1: r[1], s2: r[2], meet: r[3] };
    }, LOGO);
    void ids;
    // Print label shows on Shipping sales only
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click');
    const open = async (no) => { await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click'); await page.fill('#q', no); await page.waitForFunction((n) => document.querySelectorAll('tr.click').length === 1 && document.querySelector('tr.click').textContent.includes(n), no); await page.locator('tr.click').click(); await page.waitForSelector('.receipt'); };
    await open('S-IMM-1'); assert.equal(await page.locator('#dlabel').count(), 0, 'no label button on an Immediate sale'); await closeAll();
    await open('S-MEET-1'); assert.equal(await page.locator('#dlabel').count(), 0, 'no label button on a Meet sale'); await closeAll();
    await open('S-SHIP-1'); assert.equal(await page.locator('#dlabel').count(), 1); await page.click('#dlabel'); await page.waitForSelector('.label');

    // contents: ship-to, return address, order number and date; no carrier, tracking or note when empty; no barcode; no own cost, item cost or profit
    let lab = await page.textContent('.label');
    for (const t of ['Jordan Ellis', '2418 Maple Grove Lane', 'Apt 3B', 'Columbus, OH 43215', 'Sample Streaming Co.', '100 Example Street', 'Hagerstown, MD 21740', 'United States', 'S-SHIP-1', 'Order', 'Date']) assert.ok(lab.includes(t), t);
    assert.doesNotMatch(lab, /Carrier|Tracking|Delivery note/, 'empty fields are left out'); assert.doesNotMatch(lab, /6\.12|40\.00|cost|profit|\$/i);
    assert.equal(await page.locator('.label canvas, .label svg, .label img[src*="qr" i], .label [class*=barcode]').count(), 0, 'no barcode or QR');
    assert.equal(await page.locator('.label img.label-logo').count(), 1, 'business logo by default'); assert.equal(await page.getAttribute('.label img.label-logo', 'src'), LOGO);
    assert.match(await page.getAttribute('.label', 'class'), /size-4x6 style-themed/);

    // sizes and styles; print dimensions
    const dims = async (cls) => { await page.evaluate(() => document.documentElement.classList.add('printing', 'printing-label')); await page.emulateMedia({ media: 'print' }); const b = await page.$eval('.label', e => ({ width: e.offsetWidth, height: e.offsetHeight })); await page.evaluate(() => document.documentElement.classList.remove('printing', 'printing-label')); await page.emulateMedia({ media: 'screen' }); return [Math.round(b.width), Math.round(b.height)]; };
    assert.deepEqual(await dims(), [384, 576], '4 x 6 in');
    await pick('lsize', 'half'); assert.match(await page.getAttribute('.label', 'class'), /size-half/); assert.deepEqual(await dims(), [816, 528], 'half sheet of letter, 8.5 x 5.5 in');
    await pick('lsize', 'letter'); assert.match(await page.getAttribute('.label', 'class'), /size-letter/); assert.deepEqual(await dims(), [816, 1056], 'full letter page');
    await pick('lsize', '4x6'); await pick('lstyle', 'plain'); assert.match(await page.getAttribute('.label', 'class'), /style-plain/);
    assert.equal(await page.$eval('.label', e => getComputedStyle(e).color), 'rgb(0, 0, 0)'); assert.match(await page.$eval('.label img.label-logo', e => getComputedStyle(e).filter), /grayscale/);
    await pick('lstyle', 'themed');

    // logo choice for this print only; saved setting untouched
    await pick('llogo', 'none'); assert.equal(await page.locator('.label img.label-logo').count(), 0);
    await pick('llogo', 'custom'); assert.equal(await page.locator('.label img.label-logo').count(), 0, 'custom with no custom logo falls back to no logo, no error');
    await pick('llogo', 'business'); assert.equal(await page.locator('.label img.label-logo').count(), 1);
    // return address override for this label only
    await page.click('#lraedit'); await page.fill('#rts', '9 Other Road'); assert.match(await page.textContent('.label'), /9 Other Road/); assert.doesNotMatch(await page.textContent('.label'), /100 Example Street/);
    const saved = await page.evaluate(() => AccountApp.store.config().label); assert.equal(saved.logo, 'business'); assert.equal(saved.size, '4x6'); assert.equal(saved.returnAddress.street, '100 Example Street', 'per-label changes do not change the saved settings');

    // Print adds the print classes, calls print once, and removes them afterwards
    await page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; window.__during = document.documentElement.className; }; });
    await page.click('#lprint'); assert.equal(await page.evaluate(() => window.__prints), 1); assert.match(await page.evaluate(() => window.__during), /printing-label/);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); assert.doesNotMatch(await page.evaluate(() => document.documentElement.className), /printing/);
    await closeAll();

    // reprint after adding tracking includes carrier and tracking
    await open('S-SHIP-1'); await page.click('#dtrack'); await page.fill('.sheet #scar', 'USPS Ground'); await page.fill('.sheet #str', '9400 1000 0000 0000 0000 00'); await page.click('.sheet #go'); await page.waitForSelector('.sheet', { state: 'detached' });
    await open('S-SHIP-1'); await page.click('#dlabel'); await page.waitForSelector('.label'); lab = await page.textContent('.label'); assert.match(lab, /Carrier/); assert.match(lab, /USPS Ground/); assert.match(lab, /Tracking/); assert.match(lab, /9400 1000 0000 0000 0000 00/); await closeAll();

    // the Delivery note prints under its own heading when filled in
    await open('S-SHIP-2'); await page.click('#dlabel'); await page.waitForSelector('.label'); lab = await page.textContent('.label'); assert.match(lab, /Delivery note/); assert.match(lab, /Fragile, leave at the door/); assert.match(lab, /Casey Lane/); await closeAll();

    // batch: Print labels on the To ship filter gives one label per sale, each on its own page
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click'); await page.fill('#q', ''); await page.waitForTimeout(600); await pick('sdl', 'toship'); await page.waitForSelector('#plabels'); assert.match(await page.textContent('#plabels'), /\(2\)/);
    await page.locator('[data-plabel]').first().click(); await page.waitForTimeout(500); await page.waitForSelector('.label'); assert.equal(await page.locator('.label').count(), 1, 'one sale from its row'); await closeAll();
    await page.click('#plabels'); await page.waitForSelector('.label'); assert.equal(await page.locator('.label').count(), 2); assert.equal(await page.$eval('.label', e => getComputedStyle(e).breakAfter), 'auto', 'screen preview has no page breaks');
    await page.evaluate(() => document.documentElement.classList.add('printing', 'printing-label')); await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.label').first().evaluate(e => getComputedStyle(e).breakAfter), 'page'); assert.equal(await page.locator('.label').last().evaluate(e => getComputedStyle(e).breakAfter), 'auto');
    assert.equal(await page.locator('.label-pages').isVisible(), true); assert.equal(await page.locator('.sheet #lraw').isVisible(), false, 'controls are hidden when printing');
    await page.evaluate(() => document.documentElement.classList.remove('printing', 'printing-label')); await page.emulateMedia({ media: 'screen' }); await closeAll();

    // Settings: return address, size, style and a different label logo, saved with the account
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#ras');
    await page.fill('#ras', '55 New Street'); await page.fill('#rac', 'Frederick'); await pick('lsz', 'half'); await pick('lst', 'plain'); await pick('llg', 'custom'); await page.waitForSelector('#llfile', { state: 'attached' });
    await page.setInputFiles('#llfile', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }); await page.waitForSelector('#llpic img'); await page.click('#save'); await page.waitForSelector('.toasts .toast');
    const cfg = await page.evaluate(() => AccountApp.store.config().label); assert.equal(cfg.size, 'half'); assert.equal(cfg.look, 'plain'); assert.equal(cfg.logo, 'custom'); assert.match(cfg.customLogo, /^data:image\//); assert.equal(cfg.returnAddress.street, '55 New Street');
    await open('S-SHIP-1'); await page.click('#dlabel'); await page.waitForSelector('.label'); assert.match(await page.getAttribute('.label', 'class'), /size-half style-plain/); assert.match(await page.textContent('.label'), /55 New Street/); assert.equal(await page.locator('.label img.label-logo').count(), 1);
    assert.notEqual(await page.getAttribute('.label img.label-logo', 'src'), LOGO, 'the label uses the label logo');
    // removing the label logo falls back to no logo without an error
    await closeAll(); await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#llrm'); await page.click('#llrm'); await page.click('#save'); await page.waitForSelector('.toasts .toast');
    await open('S-SHIP-1'); await page.click('#dlabel'); await page.waitForSelector('.label'); assert.equal(await page.locator('.label img.label-logo').count(), 0); await closeAll();

    // backup and restore round trip keeps the label settings and the custom logo
    await page.evaluate(async () => { const S = AccountApp.store; await S.saveConfig({ ...S.config(), label: { ...S.config().label, customLogo: 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } }); });
    const before = await page.evaluate(() => JSON.stringify(AccountApp.store.config().label));
    const after = await page.evaluate(async () => { const A = AccountApp, S = A.store, E = A.backupEngine, f = await E.makeFile(); await S.commit({ deletes: S.all('config').map(e => ({ type: 'config', id: e.id })) });
      const parsed = await A.backupFile.read(f.text, { adk: A.vault.adk, accountCode: A.me.accountCode }); await E.run(parsed, 'replace'); return JSON.stringify(S.config().label); });
    assert.equal(after, before); assert.match(after, /55 New Street/); assert.match(after, /iVBOR/);

    // phone layout: the label view fits the screen
    await page.setViewportSize({ width: 375, height: 800 }); await open('S-SHIP-2'); await page.click('#dlabel'); await page.waitForSelector('.label'); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll on a phone');
    const b = await page.locator('.label').first().boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= 376, 'label preview fits the phone');
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});
