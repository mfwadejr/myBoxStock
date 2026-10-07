// TEST / e2e-scanner-aim — tap to aim, the "stuck" hint, a read you cannot miss (Got it for 1.5 s, green field highlight) and "Confirm each scan", with a pretend camera.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './helpers.mjs';
import { CAMERA_INIT, signup, aim, dataUrl } from './helpers-scan.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;

// A synthetic label for a box that is not a V2 Plus: the S/N barcode stacked over the MAC barcode, printed text under each (bars 510-590 and 730-810, text below them).
const STACK = dataUrl('label-stacked.png'), SINGLE = dataUrl('label-single.jpg');
const SN = 'V6PLY5260919AA01', MAC = 'A0:BB:3E:19:AA:01', SINGLE_SN = 'V6PLY5260919CE1A';
const SN_AT = [350, 550], MAC_AT = [372, 770], GAP_AT = [384, 672];   // where to tap on the picture; GAP_AT is the printed text between the two barcodes
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
const openAdd = async (page) => { await page.goto(state.srv.base + '/app/#/inventory'); await page.waitForSelector('#add'); await forceJs(page); await page.click('#add'); await page.waitForSelector('#f_serial'); };
const cancelSheet = async (page) => { if (await page.locator('.scrim .sheet').count()) { await page.click('.sheet [data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' }); } };
const camBtn = (id) => `#${id} ~ .scanbtn`;
const gone = (page) => page.waitForSelector('.scanner', { state: 'detached' });
const open = async (page, id = 'f_serial') => { await page.click(camBtn(id)); await page.waitForFunction(() => document.querySelector('.scan-video')?.videoWidth > 0); };
const tap = async (page, [ix, iy]) => { const p = await page.evaluate(([x, y]) => window.__camPoint(x, y), [ix, iy]); await page.touchscreen.tap(p.x, p.y); return p; };
const rects = (page) => page.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height, cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; }; return { box: r('.scan-box'), stage: r('.scan-stage'), panel: r('.scan-panel'), top: r('.scan-top') }; });
const setSize = (page, v) => page.evaluate((x) => localStorage.setItem('mbs.scanSize', x), v);
const hintText = (page) => page.textContent('.scan-hint');

test('setup', { skip, timeout: 120000 }, async () => { Object.assign(state, await boot()); });

test('tap to aim: the box and red line move to the tapped barcode, the crop follows, the right one is read', { skip, timeout: 170000 }, async () => {
  const { page } = state; await openAdd(page); await page.fill('#f_mac', 'x'); await setSize(page, 'small'); await page.evaluate(() => { window.__cam.focusCap = true; });
  await open(page); assert.equal(await page.getAttribute('.scan-box', 'class'), 'scan-box small');
  assert.match(await hintText(page), /Tap the barcode you want/, 'a plain first-use hint');
  await aim(page, STACK, ...GAP_AT, 1);   // the box starts on the printed text between the two barcodes: nothing under it can be read
  await sleep(1500); assert.equal(await page.inputValue('#f_serial'), ''); assert.equal(await page.getAttribute('.scanner', 'data-state'), 'look', 'the box over the printed text reads nothing');
  const before = await rects(page); const aimBefore = await page.evaluate(() => window.__camAim());
  const p = await tap(page, MAC_AT);
  const after = await rects(page), aimAfter = await page.evaluate(() => window.__camAim());
  assert.ok(Math.abs(after.box.cx - p.x) <= 2 && Math.abs(after.box.cy - p.y) <= 2, `the box is centered on the tap (${after.box.cx},${after.box.cy}) vs (${p.x},${p.y})`);
  assert.ok(Math.abs(after.box.w - before.box.w) <= 1 && Math.abs(after.box.h - before.box.h) <= 1, 'it keeps its size');
  assert.ok(after.box.cy > before.box.cy + 30, 'it moved down');
  assert.ok(Math.abs(aimAfter.y - (aimBefore.y + MAC_AT[1] - GAP_AT[1])) < 6, `the crop point follows the box: video y ${aimBefore.y.toFixed(0)} to ${aimAfter.y.toFixed(0)}`);
  assert.ok(await page.evaluate(() => document.querySelector('.scan-box').classList.contains('aimed')));
  assert.equal(await page.evaluate(() => document.querySelector('.scan-aim').getBoundingClientRect().top > document.querySelector('.scan-box').getBoundingClientRect().top), true, 'the aim line travels with the box');
  assert.doesNotMatch(await hintText(page), /Tap the barcode you want/, 'the hint is shown only until the first tap');
  await page.waitForSelector('.scanner[data-state=got]'); assert.equal(await page.textContent('.scan-value'), MAC, 'the MAC barcode that was tapped is read, not the S/N above it');
  assert.equal(await page.inputValue('#f_serial'), MAC);
  const focus = await page.evaluate(() => window.__cam.focus || []); assert.ok(focus.length >= 1 && Math.abs(focus[0].x - p.x / 375) < 0.03 && Math.abs(focus[0].y - p.y / 812) < 0.03, 'the camera was asked to focus on that point: ' + JSON.stringify(focus));
  await gone(page);
  // opened again: the aim is back at the centre (it is not remembered), the first-use hint does not return, and tapping the S/N barcode reads that one
  await page.fill('#f_serial', ''); await page.fill('#f_mac', 'x'); await open(page);
  assert.equal(await page.evaluate(() => document.querySelector('.scan-box').classList.contains('aimed')), false, 'the aim resets when the scanner opens');
  const fresh = await rects(page); assert.ok(Math.abs(fresh.box.cx - (fresh.stage.l + fresh.stage.w / 2)) <= 2 && Math.abs(fresh.box.cy - (fresh.stage.t + fresh.stage.h / 2)) <= 2, 'the box is centered again');
  assert.doesNotMatch(await hintText(page), /Tap the barcode you want/);
  await aim(page, STACK, ...GAP_AT, 1); await tap(page, SN_AT); await page.waitForSelector('.scanner[data-state=got]'); assert.equal(await page.inputValue('#f_serial'), SN, 'tapping the S/N barcode reads the S/N'); await gone(page);
  // a tap near the very edge is clamped so the whole box stays on the picture
  await page.fill('#f_serial', ''); await open(page); await page.touchscreen.tap(2, 120);
  const edge = await rects(page); assert.ok(edge.box.l >= edge.stage.l - 1 && edge.box.t >= edge.stage.t - 1 && edge.box.r <= edge.stage.r + 1 && edge.box.b <= edge.stage.b + 1, 'clamped to the picture ' + JSON.stringify(edge.box));
  await page.click('[data-act=close]'); await gone(page);
  // the Medium and Large sizes also follow a tap, and a size change keeps the aimed spot
  await page.click(camBtn('f_serial')); await page.waitForFunction(() => document.querySelector('.scan-video')?.videoWidth > 0); await aim(page, STACK, ...GAP_AT, 1);
  await tap(page, MAC_AT); const m1 = await rects(page); await page.click('[data-size=large]'); const m2 = await rects(page);
  assert.ok(Math.abs(m2.box.cy - m1.box.cy) < 90 && m2.box.h > m1.box.h, 'a bigger box stays around the aimed spot (clamped)');
  assert.deepEqual((await page.getAttribute('.scan-box', 'class')).split(' ').sort(), ['aimed', 'large', 'scan-box']);
  await page.click('[data-act=close]'); await gone(page); await setSize(page, 'medium'); assert.deepEqual(state.errors, []);
});

test('the stuck hint: after a quiet spell it says what to try, suggests Medium on Small, and clears when the box moves or something is read', { skip, timeout: 170000 }, async () => {
  const { page } = state; await page.fill('#f_serial', ''); await setSize(page, 'small');
  const defaults = await page.evaluate(() => ({ stuck: AccountApp.scanner.stuckMs, got: AccountApp.scanner.gotMs })); assert.deepEqual(defaults, { stuck: 6000, got: 1500 }, 'about 6 seconds and about 1.5 seconds');
  await page.evaluate(() => { AccountApp.scanner.stuckMs = 1500; });
  await open(page); const t0 = Date.now(); await aim(page, STACK, ...GAP_AT, 1);
  await sleep(500); assert.equal(await page.getAttribute('.scanner', 'data-stuck'), null, 'not yet'); assert.match(await hintText(page), /Fit the whole code in the box/, await page.evaluate(() => `${document.querySelector('.scan-box').className} value=${document.querySelector('.scan-value').textContent} aim=${JSON.stringify(window.__camAim())}`));
  await page.waitForSelector('.scanner[data-stuck]'); const waited = Date.now() - t0; assert.ok(waited >= 1000, `it waited (${waited} ms)`);
  const stuck = await hintText(page); assert.match(stuck, /Nothing read yet\. Put the red line across the bars, not the printed text\. Move closer and hold steady\./); assert.match(stuck, /Medium/, 'on Small it suggests Medium');
  assert.equal(await page.getAttribute('.scan-hint', 'aria-live'), 'polite', 'announced by the screen reader through the existing hint');
  await tap(page, GAP_AT); assert.equal(await page.getAttribute('.scanner', 'data-stuck'), null, 'moving the box clears it'); assert.match(await hintText(page), /^Fit the whole code in the box\.?$/);
  await page.waitForSelector('.scanner[data-stuck]');   // and it starts counting again
  await page.waitForSelector('.scanner[data-stuck]'); await page.click('[data-size=small]'); assert.equal(await page.getAttribute('.scanner', 'data-stuck'), null, 'choosing a size clears it');
  await page.waitForSelector('.scanner[data-stuck]');   // still quiet: it comes back
  await aim(page, STACK, ...SN_AT, 1); await page.waitForSelector('.scanner[data-state=got]'); assert.equal(await page.getAttribute('.scanner', 'data-stuck'), null, 'reading something clears it'); assert.equal(await hintText(page), 'Got it');
  await gone(page); await page.evaluate(() => { AccountApp.scanner.stuckMs = 6000; }); await setSize(page, 'medium');
});

test('a read is easy to notice: Got it stays about 1.5 s, then the field flashes green and the flash clears', { skip, timeout: 170000 }, async () => {
  const { page } = state; await page.fill('#f_serial', ''); await page.fill('#f_mac', 'x');
  await open(page); await aim(page, SINGLE, 385, 628, 0.85); await page.waitForSelector('.scanner[data-state=got]'); const t0 = Date.now();
  assert.equal(await page.inputValue('#f_serial'), SINGLE_SN, 'filled the moment it is read'); assert.equal(await hintText(page), 'Got it'); assert.equal(await page.textContent('.scan-value'), SINGLE_SN);
  await gone(page); const shown = Date.now() - t0; assert.ok(shown >= 1300 && shown <= 3000, `Got it was on screen for ${shown} ms`);
  await page.waitForSelector('#f_serial.scan-filled'); assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#f_serial')).animationName), 'scan-filled', 'it fades out');
  assert.equal(await page.locator('#f_mac.scan-filled').count(), 0, 'only the field that got the code');
  await page.waitForFunction(() => !document.querySelector('#f_serial').classList.contains('scan-filled'), null, { timeout: 5000 });
  // reduced motion: no animation, but the field is still marked for a moment
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.fill('#f_serial', ''); await open(page); await aim(page, SINGLE, 385, 628, 0.85); await gone(page);
  await page.waitForSelector('#f_serial.scan-filled'); const rm = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('#f_serial')); return { anim: c.animationName, shadow: c.boxShadow }; });
  assert.equal(rm.anim, 'none'); assert.notEqual(rm.shadow, 'none', 'a still green ring instead of a fade');
  await page.waitForFunction(() => !document.querySelector('#f_serial').classList.contains('scan-filled'), null, { timeout: 5000 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
  // a field that did not get a code is not highlighted: closing without a read
  await page.fill('#f_serial', ''); await open(page); await page.click('[data-act=close]'); await gone(page); assert.equal(await page.locator('.scan-filled').count(), 0);
});

test('Confirm each scan: nothing is filled until Use this; Scan again resumes; remembered on this device', { skip, timeout: 170000 }, async () => {
  const { page } = state; await page.fill('#f_serial', ''); await page.fill('#f_mac', '');
  await open(page); assert.equal(await page.getAttribute('[data-act=confirm]', 'aria-pressed'), 'false', 'off by default'); assert.equal(await page.evaluate(() => localStorage.getItem('mbs.scanConfirm')), null);
  await page.click('[data-act=confirm]'); assert.equal(await page.getAttribute('[data-act=confirm]', 'aria-pressed'), 'true'); assert.equal(await page.evaluate(() => localStorage.getItem('mbs.scanConfirm')), '1');
  await aim(page, STACK, ...GAP_AT, 1); await tap(page, SN_AT); await page.waitForSelector('.scanner[data-state=got]');
  assert.equal(await page.textContent('.scan-value'), SN); assert.match(await hintText(page), /Use this/); assert.equal(await page.inputValue('#f_serial'), '', 'nothing is filled in yet');
  await sleep(2500); assert.equal(await page.locator('.scanner').count(), 1, 'it waits for the person'); assert.equal(await page.inputValue('#f_serial'), '');
  assert.deepEqual(await page.locator('.scan-float .scan-btn').allTextContents(), ['Use this', 'Scan again']);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.scan-float .scan-btn')].map(b => b.getBoundingClientRect().height)); assert.ok(sizes.every(h => h >= 43.5), 'big enough to tap ' + sizes);
  await page.click('[data-act=redo]'); await page.waitForSelector('.scanner[data-state=look]'); assert.equal(await page.inputValue('#f_serial'), '', 'Scan again fills nothing');
  await sleep(1500); assert.equal(await page.getAttribute('.scanner', 'data-state'), 'look', 'the code just refused is not read straight back');
  await tap(page, MAC_AT); await page.waitForSelector('.scanner[data-state=got]'); assert.equal(await page.textContent('.scan-value'), MAC); assert.equal(await page.inputValue('#f_serial'), '');
  await page.click('[data-act=use]'); assert.equal(await page.inputValue('#f_serial'), MAC, 'Use this fills the field');
  await page.waitForSelector('[data-act=next]'); assert.match(await page.textContent('[data-act=next]'), /Scan MAC address/, 'the next field is still offered');
  await page.click('[data-act=close]'); await gone(page); await page.waitForSelector('#f_serial.scan-filled');
  // the choice stays on: the next scan asks again, then the setting is switched off again
  await page.fill('#f_serial', ''); await open(page); assert.equal(await page.getAttribute('[data-act=confirm]', 'aria-pressed'), 'true', 'remembered');
  await aim(page, SINGLE, 385, 628, 0.85); await page.waitForSelector('[data-act=use]'); assert.equal(await page.inputValue('#f_serial'), '');
  await page.click('[data-act=use]'); await page.waitForSelector('[data-act=next]'); assert.equal(await page.inputValue('#f_serial'), SINGLE_SN); await page.click('[data-act=close]'); await gone(page);
  // the MAC step also waits for Use this
  await page.fill('#f_serial', ''); await page.fill('#f_mac', ''); await open(page, 'f_mac'); await aim(page, SINGLE, 385, 748, 0.85); await page.waitForSelector('[data-act=use]');
  assert.equal(await page.textContent('.scan-value'), 'A0:BB:3E:19:CE:1A'); assert.equal(await page.inputValue('#f_mac'), ''); await page.click('[data-act=use]'); await gone(page); assert.equal(await page.inputValue('#f_mac'), 'A0:BB:3E:19:CE:1A');
  await page.click(camBtn('f_serial')); await page.click('[data-act=confirm]'); assert.equal(await page.getAttribute('[data-act=confirm]', 'aria-pressed'), 'false'); assert.equal(await page.evaluate(() => localStorage.getItem('mbs.scanConfirm')), null);
  await page.click('[data-act=close]'); await gone(page); assert.deepEqual(state.errors, []);
});

test('Bulk scan with Confirm each scan: a code is added only after Use this', { skip, timeout: 170000 }, async () => {
  const { page } = state; await cancelSheet(page); await page.evaluate(() => localStorage.setItem('mbs.scanConfirm', '1'));
  await page.goto(state.srv.base + '/app/#/inventory'); await page.waitForSelector('#bulk'); await forceJs(page);
  await page.click('#bulk'); await page.uncheck('[data-id=uid]'); await page.uncheck('[data-id=mac]'); await setSize(page, 'small');
  await page.click('#scanbox ~ .scanbtn'); await page.waitForFunction(() => document.querySelector('.scan-video')?.videoWidth > 0); assert.match(await page.textContent('.scan-title'), /Serial number/);
  await aim(page, STACK, ...GAP_AT, 1); await tap(page, SN_AT); await page.waitForSelector('[data-act=use]');
  assert.equal(await page.locator('#blist .chip').count(), 0, 'not added yet'); assert.equal(await page.textContent('.scan-value'), SN);
  await page.click('[data-act=use]'); await page.waitForFunction(() => document.querySelectorAll('#blist .chip').length === 1);
  await page.waitForFunction(() => document.querySelector('.scanner')?.dataset.state === 'look');   // bulk stays open for the next label
  await tap(page, MAC_AT); await page.waitForSelector('[data-act=use]'); assert.equal(await page.locator('#blist .chip').count(), 1);
  await page.click('[data-act=redo]'); await page.waitForSelector('.scanner[data-state=look]'); assert.equal(await page.locator('#blist .chip').count(), 1, 'Scan again adds nothing');
  await tap(page, SN_AT); await sleep(1500);   // the S/N is already in the batch: it is shown for confirming, and refused only on Use this
  if (await page.locator('[data-act=use]').count()) { await page.click('[data-act=use]'); await page.waitForSelector('.scanner[data-state=warn]'); assert.match(await hintText(page), /already scanned/); }
  assert.equal(await page.locator('#blist .chip').count(), 1);
  await page.click('[data-act=close]'); await gone(page); await page.evaluate(() => localStorage.removeItem('mbs.scanConfirm')); await setSize(page, 'medium'); await cancelSheet(page);
});

test('layout: phone portrait and landscape - the aimed box stays on the picture, clear of the controls, nothing scrolls sideways, buttons are 44px', { skip, timeout: 170000 }, async () => {
  const { page } = state; await cancelSheet(page);
  for (const [name, w, h, vw, vh] of [['portrait', 375, 812, 720, 1280], ['landscape', 812, 375, 1280, 720], ['small phone', 320, 568, 720, 1280]]) {
    await page.setViewportSize({ width: w, height: h }); await page.evaluate(([a, b]) => { window.__cam.vw = a; window.__cam.vh = b; }, [vw, vh]);
    await page.goto(state.srv.base + '/app/#/inventory'); await page.waitForSelector('#add'); await forceJs(page); await page.click('#add'); await page.waitForSelector('#f_serial');
    await page.fill('#f_serial', ''); await page.fill('#f_mac', 'x'); await page.evaluate(() => localStorage.setItem('mbs.scanConfirm', '1'));
    await open(page); await aim(page, SINGLE, 385, 628, 0.85);
    for (const corner of [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98], [0.5, 0.5]]) {
      const r0 = await rects(page); await page.touchscreen.tap(r0.stage.l + r0.stage.w * corner[0], r0.stage.t + r0.stage.h * corner[1]);
      const m = await rects(page);
      assert.ok(m.box.l >= m.stage.l - 1 && m.box.r <= m.stage.r + 1 && m.box.t >= m.stage.t - 1 && m.box.b <= m.stage.b + 1, `${name}: box off the picture ${JSON.stringify(m.box)}`);
      assert.ok(!(m.box.b > m.panel.t + 1 && m.box.r > m.panel.l + 1 && m.box.t < m.panel.b), `${name}: box under the controls`); assert.ok(m.box.t >= m.top.b - 1, `${name}: box under the title bar`);
    }
    const side = await page.evaluate(() => { const L = document.querySelector('.scanner'); return { page: document.documentElement.scrollWidth - innerWidth, layer: L.scrollWidth - L.clientWidth, layerV: L.scrollHeight - L.clientHeight, min: Math.min(...[...L.querySelectorAll('.scan-btn')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)) }; });
    assert.ok(side.page <= 0 && side.layer <= 0 && side.layerV <= 0, `${name}: scrolls ${JSON.stringify(side)}`); assert.ok(side.min >= 43.5, `${name}: a button is ${side.min}px tall`);
    await tap(page, [350, 540]); await page.waitForSelector('[data-act=use]');   // the Use this panel fits on screen and is 44px
    const u = await page.evaluate(() => { const bs = [...document.querySelectorAll('.scan-float .scan-btn')].map(b => b.getBoundingClientRect()); return { minH: Math.min(...bs.map(b => b.height)), l: Math.min(...bs.map(b => b.left)), r: Math.max(...bs.map(b => b.right)), b: Math.max(...bs.map(b => b.bottom)), w: innerWidth, h: innerHeight }; });
    assert.ok(u.minH >= 43.5 && u.l >= 0 && u.r <= u.w && u.b <= u.h, `${name}: Use this panel ${JSON.stringify(u)}`);
    const hint = await page.evaluate(() => { const b = document.querySelector('.scan-hint').getBoundingClientRect(); return { t: b.top, b: b.bottom, h: innerHeight }; }); assert.ok(hint.t >= 0 && hint.b <= hint.h, `${name}: hint off screen`);
    await page.click('[data-act=close]'); await gone(page); await page.click('.sheet [data-cancel]');
  }
  await page.evaluate(() => localStorage.removeItem('mbs.scanConfirm')); assert.deepEqual(state.errors, []);
});

test('teardown', { skip }, async () => { if (state.br) await state.br.close(); state.srv?.stop(); });
