// TEST / e2e-scanner — the phone-camera scanner end to end with a pretend camera: reading, choosing, the MAC rule, fallbacks, error messages, cleanup and layouts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './helpers.mjs';
import { CAMERA_INIT, signup, aim, dataUrl, FIX } from './helpers-scan.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const SHOTS = process.env.SHOTS_DIR;   // set to also save screenshots to look at

const SINGLE = dataUrl('label-single.jpg'), TWO = dataUrl('label-two.jpg');
const SN = 'V6PLY5260919CE1A', MAC = 'A0:BB:3E:19:CE:1A', UID = '273D00000019CE1A';
const state = {};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function boot(viewport = { width: 375, height: 812 }) {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
  const ctx = await br.newContext({ viewport, hasTouch: true }); await ctx.addInitScript(CAMERA_INIT);
  const page = await ctx.newPage(); page.setDefaultTimeout(30000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await signup(page, srv);
  return { srv, br, ctx, page, errors };
}
const forceJs = (page) => page.evaluate(() => { AccountApp.scanner.engine = 'zxing'; });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const openAdd = async (page) => { await page.goto(state.srv.base + '/app/#/inventory'); await page.waitForSelector('#add'); await forceJs(page); await page.click('#add'); await page.waitForSelector('#f_serial'); };
const camBtn = (id) => `#${id} ~ .scanbtn`;
const noSheet = async (page) => { if (await page.locator('.scrim .sheet').count()) { await page.click('.sheet [data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' }); } };
const gone = (page) => page.waitForSelector('.scanner', { state: 'detached' });
const stopped = (page) => page.evaluate(() => window.__cam.stopped);

test('setup', { skip, timeout: 120000 }, async () => { Object.assign(state, await boot()); });

test('serial from one label: nearest code to the aim line wins, presets are remembered, then the next field', { skip, timeout: 170000 }, async () => {
  const { page } = state; await openAdd(page);
  // Medium (the default): the SN barcode is in the middle of the label, UID above and MAC below are farther from the aim line
  await page.click(camBtn('f_serial')); assert.equal(await page.getAttribute('.scan-box', 'class'), 'scan-box medium');
  assert.match(await page.textContent('.scan-hint'), /Fit the whole code in the box/);
  assert.ok((await page.evaluate(() => window.__cam.constraints)).video.facingMode.ideal === 'environment');
  await aim(page, SINGLE, 385, 628, 0.85); await shot(page, 'portrait-looking');
  await page.waitForSelector('.scanner[data-state=got]'); assert.equal(await page.textContent('.scan-value'), SN); await shot(page, 'portrait-got');
  assert.equal(await page.inputValue('#f_serial'), SN, 'the serial field is filled the moment it is read');
  // "Scan the next field": the MAC address
  assert.match(await page.textContent('[data-act=next]'), /Scan MAC address/); await page.click('[data-act=next]');
  assert.match(await page.textContent('.scan-title'), /MAC address/);
  await aim(page, SINGLE, 385, 748, 0.85); await gone(page);
  assert.equal(await page.inputValue('#f_mac'), MAC, 'the MAC is normalized');
  assert.ok(await stopped(page) >= 1, 'the camera stream was stopped on close');
  // Large, remembered on this device
  await page.fill('#f_serial', ''); await page.click(camBtn('f_serial')); await page.click('[data-size=large]');
  assert.equal(await page.evaluate(() => localStorage.getItem('mbs.scanSize')), 'large');
  await aim(page, SINGLE, 385, 628, 0.85); await page.waitForSelector('.scanner[data-state=got]'); assert.equal(await page.inputValue('#f_serial'), SN); await shot(page, 'portrait-large');
  await page.click('[data-act=close]'); await gone(page);
  await page.fill('#f_serial', ''); await page.click(camBtn('f_serial')); assert.equal(await page.getAttribute('.scan-box', 'class'), 'scan-box large', 'the size comes back next time');
  await page.click('[data-act=close]'); await gone(page);
});

test('MAC field ignores a serial and fills a normalized MAC; Small isolates one barcode', { skip, timeout: 170000 }, async () => {
  const { page } = state; await page.evaluate(() => localStorage.setItem('mbs.scanSize', 'medium'));
  await page.fill('#f_serial', ''); await page.fill('#f_mac', '');
  await page.click(camBtn('f_mac'));
  await aim(page, SINGLE, 385, 628, 0.85);   // the SN barcode is nearest, but it is not a MAC, so the MAC below it is used
  await page.waitForSelector('.scanner[data-state=got]'); assert.equal(await page.inputValue('#f_mac'), MAC); await gone(page);
  // Small: a thin strip that sees only one barcode of the three
  await page.click(camBtn('f_serial')); await page.click('[data-size=small]'); assert.equal(await page.getAttribute('.scan-box', 'class'), 'scan-box small');
  await aim(page, SINGLE, 385, 511, 0.85); await page.waitForSelector('.scanner[data-state=got]');
  assert.equal(await page.inputValue('#f_serial'), UID, 'the strip around the top barcode read only that barcode'); await shot(page, 'portrait-small');
  await gone(page); await page.evaluate(() => localStorage.setItem('mbs.scanSize', 'medium'));
});

test('two codes about equally close show a big tappable choice', { skip, timeout: 170000 }, async () => {
  const { page } = state; await page.fill('#f_serial', ''); await page.click(camBtn('f_serial')); await page.click('[data-size=large]');
  await aim(page, TWO, 330, 857, 1);   // exactly between the SN and MAC barcodes of the lower label
  await page.waitForSelector('.scan-choice'); const vals = await page.locator('.scan-choice').allTextContents(); await shot(page, 'portrait-choice');
  assert.equal(vals.length, 2, 'two choices: ' + vals); assert.ok(vals.some(v => /^V6PLY5260919D0F1$/.test(v)) && vals.some(v => v === 'A0:BB:3E:19:D0:F1'), vals.join(' | '));
  assert.equal(await page.inputValue('#f_serial'), '', 'nothing is guessed');
  await page.locator('.scan-choice', { hasText: 'V6PLY5260919D0F1' }).click(); await page.waitForSelector('.scanner[data-state=got]');
  assert.equal(await page.inputValue('#f_serial'), 'V6PLY5260919D0F1'); await gone(page); await page.evaluate(() => localStorage.setItem('mbs.scanSize', 'medium'));
});

test('QR, EAN-13, a MAC without colons and a MAC with dashes', { skip, timeout: 170000 }, async () => {
  const { page } = state;
  const one = async (field, img, size, scale, expect) => { await page.fill('#' + field, ''); await page.click(camBtn(field)); await page.click(`[data-size=${size}]`); await aim(page, dataUrl(img), undefined, undefined, scale);
    await page.waitForSelector('.scanner[data-state=got]'); assert.equal(await page.inputValue('#' + field), expect, img); await gone(page); };
  await one('f_serial', 'qr.png', 'large', 1.2, 'QR-SN-0042-XYZ');
  await one('f_serial', 'ean13.png', 'medium', 0.6, '5901234123457');
  await one('f_serial', 'plain-sn.png', 'medium', 0.5, 'SN-WEB-4417');
  await one('f_mac', 'mac-plain.png', 'medium', 0.5, 'A0:BB:3E:19:CE:1A');
  await one('f_mac', 'mac-dashes.png', 'medium', 0.4, 'A0:BB:3E:19:CE:1A');
  // a MAC scan ignores values that are not a MAC: a plain serial barcode gives only the "nothing" hint and no value
  await page.fill('#f_mac', ''); await page.click(camBtn('f_mac')); await aim(page, dataUrl('plain-sn.png'), undefined, undefined, 0.5); await sleep(3000);
  assert.equal(await page.inputValue('#f_mac'), ''); assert.equal(await page.getAttribute('.scanner', 'data-state'), 'look');
  await page.click('[data-act=close]'); await gone(page); await page.evaluate(() => localStorage.setItem('mbs.scanSize', 'medium'));
});

test('type it instead, the photo fallback, torch, vibration, wake lock and sound are optional extras', { skip, timeout: 170000 }, async () => {
  const { page } = state; await page.fill('#f_mac', 'x');   // (the MAC box is filled so the scanner does not offer "Scan MAC address next")
  await page.fill('#f_serial', ''); await page.click(camBtn('f_serial')); await page.click('[data-act=type]'); await gone(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'f_serial', 'the cursor is in the field to type');
  // the photo: several codes found, tap to choose
  await page.click(camBtn('f_serial')); await page.setInputFiles('.scan-file', `${FIX}/label-single.jpg`);
  await page.waitForSelector('.scan-choice'); const vals = await page.locator('.scan-choice').allTextContents(); assert.ok(vals.length >= 2 && vals.includes(SN), vals.join(' | '));
  await page.locator('.scan-choice', { hasText: SN }).click(); await gone(page); assert.equal(await page.inputValue('#f_serial'), SN);
  // the photo in the MAC field: only a MAC counts, so a single value is taken without asking
  await page.fill('#f_mac', ''); await page.click(camBtn('f_mac')); await page.setInputFiles('.scan-file', `${FIX}/label-single.jpg`); await gone(page); assert.equal(await page.inputValue('#f_mac'), MAC);
  // a photo with no code in it
  await page.click(camBtn('f_serial')); await page.setInputFiles('.scan-file', `${FIX}/../../../public/favicon.ico`).catch(() => {});
  await page.click('[data-act=close]'); await gone(page);
  // vibration, wake lock, sound: used where the phone has them, released on close
  await page.evaluate(() => { window.__buzz = 0; window.__lock = { req: 0, rel: 0 }; navigator.vibrate = () => { window.__buzz++; return true; };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__lock.req++; return { release: async () => { window.__lock.rel++; }, addEventListener() {} }; } } }); window.__cam.torchCap = true; });
  await page.fill('#f_serial', ''); await page.click(camBtn('f_serial')); await page.waitForSelector('[data-act=flash]:not([hidden])');
  await page.click('[data-act=flash]'); assert.equal(await page.evaluate(() => window.__cam.torch), true, 'the flash turned on');
  await aim(page, SINGLE, 385, 628, 0.85); await page.waitForSelector('.scanner[data-state=got]'); await gone(page);
  const r = await page.evaluate(() => ({ buzz: window.__buzz, lock: window.__lock })); assert.ok(r.buzz >= 1, 'vibrated'); assert.equal(r.lock.req, 1); assert.equal(r.lock.rel, 1, 'the screen lock is let go');
  await page.evaluate(() => { window.__cam.torchCap = false; });
  await page.click(camBtn('f_serial')); await page.waitForFunction(() => document.querySelector('.scan-video')?.videoWidth > 0); assert.equal(await page.locator('[data-act=flash]').isVisible(), false, 'no flash button where the camera has none');
  await page.keyboard.press('Escape'); await gone(page); assert.ok(await page.locator('#f_serial').isVisible() && await page.locator('.sheet').count() === 1, 'Escape closes only the scanner, not the form behind it');
});

test('plain-English messages: no permission, no camera, busy camera, not https', { skip, timeout: 170000 }, async () => {
  const { page } = state;
  for (const [mode, re] of [['denied', /turned off for this site/], ['none', /No camera was found/], ['busy', /camera is busy/]]) {
    await page.evaluate((m) => { window.__cam.mode = m; }, mode); await page.click(camBtn('f_serial')); await page.waitForSelector('.scanner[data-state=warn]');
    assert.match(await page.textContent('.scan-hint'), re); assert.equal(await page.locator('[data-act=retry]').isVisible(), true); assert.equal(await page.locator('[data-act=type]').isVisible(), true); assert.equal(await page.locator('[data-act=photo]').isVisible(), true);
    if (mode === 'denied') await shot(page, 'portrait-denied');
    await page.evaluate(() => { window.__cam.mode = 'ok'; }); await page.click('[data-act=retry]'); await page.waitForFunction(() => document.querySelector('.scan-video')?.videoWidth > 0); assert.equal(await page.getAttribute('.scanner', 'data-state'), 'look', 'Try again starts the camera');
    await page.click('[data-act=close]'); await gone(page);
  }
  await page.evaluate(() => { window.__insecure = true; }); await page.click(camBtn('f_serial')); await page.waitForSelector('.scanner[data-state=warn]'); assert.match(await page.textContent('.scan-hint'), /https/);
  const started = await page.evaluate(() => window.__cam.started); await page.evaluate(() => { window.__insecure = false; }); await page.click('[data-act=close]'); await gone(page); assert.ok(started >= 1);
  assert.deepEqual(state.errors, []);
});

test('a phone BarcodeDetector is used when there is one', { skip, timeout: 120000 }, async () => {
  const { page } = state;
  await page.evaluate(() => { AccountApp.scanner.engine = 'auto'; window.BarcodeDetector = class { static async getSupportedFormats() { return ['code_128', 'qr_code', 'ean_13']; } async detect() { return [{ rawValue: 'NATIVE-123', format: 'code_128', boundingBox: { x: 0, y: 0, width: 400, height: 40 }, cornerPoints: [] }]; } }; });
  await page.fill('#f_serial', ''); await page.click(camBtn('f_serial')); await page.waitForSelector('.scanner[data-state=got]');
  assert.equal(await page.inputValue('#f_serial'), 'NATIVE-123'); await gone(page);
  await page.evaluate(() => { delete window.BarcodeDetector; AccountApp.scanner.engine = 'zxing'; });
});

test('bulk scan appends one code per device; quick sale adds the matching device; the inventory search fills', { skip, timeout: 170000 }, async () => {
  const { page } = state; await noSheet(page);
  await page.evaluate(async () => { await AccountApp.store.commit({ puts: [{ type: 'item', data: { serial: 'V6PLY5260919CE1A', make: 'vSee', model: 'Box', status: 'available', cost: 1000, price: 5000, addedAt: Date.now() } }] }); });
  await page.goto(state.srv.base + '/app/#/inventory'); await page.waitForSelector('#bulk'); await forceJs(page);
  await page.click('#bulk'); await page.uncheck('[data-id=uid]'); await page.uncheck('[data-id=mac]');
  await page.click('#scanbox ~ .scanbtn'); assert.match(await page.textContent('.scan-title'), /Serial number/);
  await aim(page, TWO, 330, 812, 1); await page.waitForFunction(() => document.querySelectorAll('#blist .chip').length === 1);
  await page.waitForFunction(() => document.querySelector('.scanner')?.dataset.state === 'look');   // it stays open for the next device
  await aim(page, dataUrl('plain-sn.png'), undefined, undefined, 0.5);
  await page.waitForFunction(() => document.querySelectorAll('#blist .chip').length === 2); await shot(page, 'portrait-bulk');
  // a serial that is already in the inventory is refused with the screen's own message, and no third device appears
  await page.waitForFunction(() => document.querySelector('.scanner')?.dataset.state === 'look');
  await aim(page, SINGLE, 385, 628, 0.85); await page.waitForSelector('.scanner[data-state=warn]'); assert.match(await page.textContent('.scan-hint'), /Another device already has that Serial number/);
  assert.equal(await page.locator('#blist .chip').count(), 2);
  await page.click('[data-act=close]'); await gone(page);
  const chips = await page.locator('#blist .chip').allTextContents(); assert.deepEqual(chips.map(t => t.trim()), ['V6PLY5260919D0F1', 'SN-WEB-4417']);
  await page.click('.sheet [data-cancel]');
  // inventory search
  await page.click('#q ~ .scanbtn'); await aim(page, SINGLE, 385, 628, 0.85); await page.waitForSelector('.scanner[data-state=got]'); await gone(page);
  assert.equal(await page.inputValue('#q'), SN);
  // quick sale: the matching device goes in the cart; a code that matches nothing is explained in the scanner
  await page.goto(state.srv.base + '/app/#/sell'); await page.waitForSelector('#scan'); await forceJs(page);
  await page.click('#scan ~ .scanbtn'); await aim(page, TWO, 330, 812, 1); await page.waitForSelector('.scanner[data-state=warn]'); assert.match(await page.textContent('.scan-hint'), /Nothing in your inventory matches/); await shot(page, 'portrait-sell-nomatch');
  await aim(page, SINGLE, 385, 628, 0.85); await page.waitForSelector('.scanner[data-state=got]'); await gone(page);
  assert.equal(await page.locator('#cart .cart-line').count(), 1, 'the device is in the cart');
});

test('layout: phone portrait, phone landscape, laptop - nothing scrolls sideways, buttons are 44px, the box is on screen', { skip, timeout: 170000 }, async () => {
  const { page } = state; await noSheet(page);
  for (const [name, w, h, vw, vh] of [['portrait', 375, 812, 720, 1280], ['landscape', 812, 375, 1280, 720], ['laptop', 1280, 800, 1280, 720], ['tablet', 768, 1024, 720, 1280]]) {
    await page.setViewportSize({ width: w, height: h }); await page.evaluate(([a, b]) => { window.__cam.vw = a; window.__cam.vh = b; }, [vw, vh]);
    await page.goto(state.srv.base + '/app/#/inventory'); await page.waitForSelector('#add'); await forceJs(page); await page.click('#add'); await page.waitForSelector('#f_serial');
    await page.click(camBtn('f_serial')); await aim(page, SINGLE, 385, 628, name === 'laptop' ? 0.6 : 0.85); await page.waitForSelector('.scanner[data-state=got]'); await shot(page, `${name}-got`);
    await page.click('[data-act=redo]'); await page.waitForSelector('.scanner[data-state=look]');
    const m = await page.evaluate(() => { const L = document.querySelector('.scanner'), r = (e) => e.getBoundingClientRect(); const btns = [...L.querySelectorAll('.scan-btn')].filter(b => b.offsetParent).map(b => Math.round(r(b).height));
      const box = r(L.querySelector('.scan-box')), p = r(L.querySelector('.scan-panel')), top = r(L.querySelector('.scan-top'));
      return { side: document.documentElement.scrollWidth - innerWidth, layer: L.scrollWidth - L.clientWidth, layerV: L.scrollHeight - L.clientHeight, minBtn: Math.min(...btns), box: { l: box.left, r: box.right, t: box.top, b: box.bottom }, panelB: p.bottom, topB: top.bottom, w: innerWidth, h: innerHeight, overlap: box.bottom > p.top + 1 && box.right > p.left + 1 && box.top < p.bottom }; });
    assert.ok(m.side <= 0 && m.layer <= 0 && m.layerV <= 0, `${name}: scrolls ${JSON.stringify(m)}`); assert.ok(m.minBtn >= 43.5, `${name}: a button is only ${m.minBtn}px tall`);
    assert.ok(m.box.l >= 0 && m.box.r <= m.w && m.box.t >= m.topB - 1 && m.box.b <= m.h, `${name}: box outside ${JSON.stringify(m)}`); assert.ok(!m.overlap, `${name}: box under the controls ${JSON.stringify(m)}`);
    await page.click('[data-act=close]'); await gone(page); await page.click('.sheet [data-cancel]');
  }
  assert.deepEqual(state.errors, []);
});

test('teardown', { skip }, async () => { if (state.br) await state.br.close(); state.srv?.stop(); });
