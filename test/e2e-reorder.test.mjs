// TEST / e2e-reorder — Settings lists (device details, test steps, payment methods, warranty periods) are locked until their Reorder switch is on;
// then a six-dot grip moves a row by mouse, by finger (touch emulation) or by keyboard (Space, arrows, Space); the order is saved and used.
// Also: no sideways scrolling at 375px, the grip is 44px, the page auto-scrolls while dragging, and the Full backup chip keeps its spacing on a phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';
const SHOTS = process.env.SHOTS_DIR || '';

const signUp = async (page, srv, name, user) => {
  await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
  await page.fill('#bn', name); await page.fill('#em', user + '@example.com'); await page.fill('#un', user); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const login = user + '@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
  await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
  await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.main');
};
const names = (page, k) => page.$$eval(`[data-k=${k}]`, els => els.map(e => e.value));
const toggle = (page, list) => page.locator(`[data-reorder=${list}]`).evaluate(e => e.click());
const grips = (page, list) => page.locator(`[data-list=${list}] .grip`);
const noSideways = (page, label) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then(o => assert.ok(o <= 1, `${label}: the page scrolls sideways by ${o}px`));
const live = (page) => page.textContent('#rlive');

// Touch drag through the browser's own touch input (Playwright has taps only).
const touchDrag = async (page, cdp, from, to) => {
  const pt = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x, from.y) });
  const steps = 12; for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps) }); await page.waitForTimeout(25); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };

test('browser: Reorder switch, mouse drag, keyboard move, lock, and the saved order', { skip, timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await signUp(page, srv, 'Order Co', 'olga');
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('[data-k=fl]');
    // off by default: locked, no handles, no old arrows, no Order column
    for (const l of ['fields', 'steps', 'pay', 'war']) { assert.equal(await page.locator(`[data-reorder=${l}]`).isChecked(), false, `${l}: Reorder starts off`); assert.equal(await grips(page, l).count(), 0, `${l}: no handles while off`); }
    assert.equal(await page.locator('.move-btns, .icon-btn.move').count(), 0, 'the old up and down arrows are gone');
    assert.ok(!(await page.textContent('.check-head')).includes('Order'), 'no Order column while off');
    const f0 = await names(page, 'fl'); assert.ok(f0.length >= 3);
    // switch on: a handle on every row, 44px
    await toggle(page, 'fields'); await page.waitForSelector('[data-list=fields] .grip');
    assert.equal(await grips(page, 'fields').count(), f0.length); assert.equal(await grips(page, 'steps').count(), 0, 'other lists stay locked');
    const gb = await grips(page, 'fields').first().boundingBox(); assert.ok(gb.width >= 43.5 && gb.height >= 43.5, `handle is 44px (${gb.width}x${gb.height})`);
    assert.equal(await grips(page, 'fields').first().evaluate(e => getComputedStyle(e).touchAction), 'none', 'touch-action none on the handle');
    assert.notEqual(await page.locator('[data-list=fields] .check-row').first().evaluate(e => getComputedStyle(e).touchAction), 'none', 'but not on the row');
    // mouse: drag the first row below the second
    const a = await center(grips(page, 'fields').nth(0)), b = await center(grips(page, 'fields').nth(1));
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x, a.y + 10, { steps: 3 }); await page.mouse.move(b.x, b.y + b.b.height * 0.4, { steps: 8 });
    assert.equal(await page.locator('.drag-row').count(), 1, 'the row being dragged is marked');
    await page.mouse.up();
    const f1 = await names(page, 'fl'); assert.deepEqual(f1.slice(0, 2), [f0[1], f0[0]], 'dragging the handle moved the first detail below the second');
    assert.equal(await page.locator('.drag-row').count(), 0);
    // dragging the row body (not the handle) does nothing
    const body = await center(page.locator('[data-k=fl]').first()); await page.mouse.move(body.x + 40, body.y); await page.mouse.down(); await page.mouse.move(body.x + 40, body.y + 120, { steps: 5 }); await page.mouse.up();
    assert.deepEqual((await names(page, 'fl')).slice(0, 2), [f0[1], f0[0]], 'only the handle moves a row');
    // keyboard: focus the handle of row 3, Space, Up, Up, Space; spoken updates
    await grips(page, 'fields').nth(2).focus(); await page.keyboard.press('Space');
    assert.equal(await grips(page, 'fields').nth(2).getAttribute('aria-pressed'), 'true'); assert.match(await live(page), /Picked up .*position 3 of/);
    await page.keyboard.press('ArrowUp'); assert.match(await live(page), /position 2 of/); await page.keyboard.press('ArrowUp'); assert.match(await live(page), /position 1 of/);
    await page.keyboard.press('ArrowUp'); assert.match(await live(page), /Already first/);
    await page.keyboard.press('Space'); assert.match(await live(page), /Dropped .* at position 1 of/);
    const f2 = await names(page, 'fl'); assert.deepEqual(f2.slice(0, 3), [f0[2], f0[1], f0[0]], 'keyboard moved the third detail to the top');
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('grip') && document.activeElement.closest('[data-ri]').dataset.ri), '0', 'focus stays on the moved row\'s handle');
    // Escape puts the row back
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
    assert.deepEqual((await names(page, 'fl')).slice(0, 3), f2.slice(0, 3), 'Escape cancels a keyboard move'); assert.match(await live(page), /cancelled/);
    // the other lists: payment methods by keyboard, warranty periods by mouse, steps by keyboard
    const p0 = await names(page, 'pl'); await toggle(page, 'pay'); await grips(page, 'pay').nth(0).focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
    assert.deepEqual((await names(page, 'pl')).slice(0, 2), [p0[1], p0[0]], 'payment methods reorder');
    const w0 = await names(page, 'wl'); await toggle(page, 'war'); await page.waitForSelector('[data-list=war] .grip');
    const wa = await center(grips(page, 'war').nth(0)), wb = await center(grips(page, 'war').nth(1));
    await page.mouse.move(wa.x, wa.y); await page.mouse.down(); await page.mouse.move(wb.x, wb.y + wb.b.height * 0.4, { steps: 8 }); await page.mouse.up();
    assert.deepEqual((await names(page, 'wl')).slice(0, 2), [w0[1], w0[0]], 'warranty periods reorder');
    const s0 = await names(page, 'sl'); assert.ok(s0.length >= 2); await toggle(page, 'steps'); await grips(page, 'steps').nth(0).focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
    assert.deepEqual((await names(page, 'sl')).slice(0, 2), [s0[1], s0[0]], 'test steps reorder');
    // switch off locks the order in: handles gone, order kept
    for (const l of ['fields', 'steps', 'pay', 'war']) { if (await page.locator(`[data-reorder=${l}]`).isChecked()) await toggle(page, l); assert.equal(await grips(page, l).count(), 0, `${l}: locked again`); }
    assert.deepEqual((await names(page, 'fl')).slice(0, 3), f2.slice(0, 3), 'turning the switch off keeps the order');
    // save, leave, come back: order persisted and used by Add device
    await page.click('#save'); await page.waitForTimeout(800);
    await page.evaluate(() => { location.hash = '#/inventory'; }); await page.waitForSelector('#add'); await page.evaluate(() => { location.hash = '#/settings'; }); await page.waitForSelector('[data-k=fl]');
    assert.deepEqual((await names(page, 'fl')).slice(0, 3), f2.slice(0, 3), 'detail order kept after saving and reloading');
    assert.deepEqual((await names(page, 'sl')).slice(0, 2), [s0[1], s0[0]]); assert.deepEqual((await names(page, 'pl')).slice(0, 2), [p0[1], p0[0]]); assert.deepEqual((await names(page, 'wl')).slice(0, 2), [w0[1], w0[0]]);
    await page.evaluate(() => { location.hash = '#/inventory'; }); await page.waitForSelector('#add'); await page.click('#add');
    const labels = await page.$$eval('.sheet .field > label', els => els.map(e => e.textContent)); assert.ok(labels.indexOf(f0[2]) < labels.indexOf(f0[1]) && labels.indexOf(f0[1]) < labels.indexOf(f0[0]), 'the Add device form follows the new order');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});

test('browser: phone (375px) - touch drag, auto-scroll, no sideways scroll, chip spacing', { skip, timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
  const ctx = await br.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await signUp(page, srv, 'Phone Order', 'pia');
    // Full backup card: the chip (wrapped under the text) leaves a gap above the next row
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#lb');
    const gap = await page.evaluate(() => { const c = document.querySelector('#lb').getBoundingClientRect(), n = document.querySelector('#lb').closest('.card').querySelector('.setting').getBoundingClientRect(), d = document.querySelector('#lb').closest('.card-head').firstElementChild.getBoundingClientRect(); return { wrapped: c.top >= d.bottom - 1, gap: n.top - c.bottom }; });
    assert.ok(gap.wrapped, 'at 375px the chip wraps under the description'); assert.ok(gap.gap >= 11.5, `the chip has space (${gap.gap}px) above the next row`);
    await noSideways(page, 'backup');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reorder-backup-375.png` });
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('[data-k=fl]'); await noSideways(page, 'settings, reorder off');
    // phone: handles appear only when on, 44px, and no sideways scroll with them showing
    await toggle(page, 'fields'); await toggle(page, 'war'); await toggle(page, 'pay'); await toggle(page, 'steps'); await page.waitForSelector('[data-list=steps] .grip');
    for (const l of ['fields', 'war', 'pay', 'steps']) { const n = await grips(page, l).count(); assert.ok(n >= 1); for (let i = 0; i < n; i++) { const b = await grips(page, l).nth(i).boundingBox(); assert.ok(b.width >= 43.5 && b.height >= 43.5, `${l} handle ${i} is 44px`); } }
    await noSideways(page, 'settings, reorder on');
    // touch: drag the first warranty period below the second with a finger
    const w0 = await names(page, 'wl'); await grips(page, 'war').first().scrollIntoViewIfNeeded();
    const a = await center(grips(page, 'war').nth(0)), b = await center(grips(page, 'war').nth(1)), y0 = await page.evaluate(() => scrollY);
    const row2 = await page.locator('[data-list=war] .war-row').nth(1).boundingBox();   // phone rows are tall: drop past the middle of the second row
    await touchDrag(page, cdp, a, { x: b.x, y: row2.y + row2.height * 0.7 });
    assert.deepEqual((await names(page, 'wl')).slice(0, 2), [w0[1], w0[0]], 'a finger on the handle moved the row');
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - y0) < 2, 'the page did not scroll while dragging inside the screen');
    // touching the row away from the handle scrolls the page instead of moving the row
    const before = await names(page, 'wl'), t0 = await page.evaluate(() => scrollY), row = await center(page.locator('[data-list=war] .war-row').nth(0));
    await touchDrag(page, cdp, { x: row.x, y: row.y }, { x: row.x, y: Math.max(20, row.y - 200) }); await page.waitForTimeout(300);
    assert.deepEqual(await names(page, 'wl'), before, 'swiping on the row (not the handle) moves nothing'); assert.ok((await page.evaluate(() => scrollY)) > t0 + 50, 'it scrolls the page');
    // auto-scroll: hold a payment-method row near the bottom edge; the page scrolls and the row travels down
    await page.evaluate(() => { document.querySelector('[data-list=pay]').scrollIntoView({ block: 'start' }); scrollBy(0, -150); }); await page.waitForTimeout(100);   // list near the top, below the top bar
    const p0 = await names(page, 'pl'), pa = await center(grips(page, 'pay').nth(0)), s1 = await page.evaluate(() => scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pa.x, y: pa.y, id: 1 }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pa.x, y: pa.y + (655 - pa.y) * i / 6, id: 1 }] }); await page.waitForTimeout(25); }
    await page.waitForTimeout(900); const s2 = await page.evaluate(() => scrollY); 
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(s2 > s1 + 100, `the page scrolled by itself near the bottom edge (${s1} to ${s2})`);
    const p1 = await names(page, 'pl'); assert.equal(p1.length, p0.length); assert.notDeepEqual(p1, p0, 'the held row travelled down the list'); assert.equal(p1[p1.length - 1], p0[0], 'to the bottom, when held at the bottom edge');
    await noSideways(page, 'after drag');
    if (SHOTS) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${SHOTS}/reorder-settings-375.png` }); }
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
