// TEST / e2e-account-menu — the account menu in both top bars: opens and closes, keyboard, Site admin only when linked, Sign out, 44px rows, no overflow.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', SHOTS = process.env.SHOT_DIR || '/tmp';
const SIZES = [['phone', 375, 812], ['tablet', 768, 1024], ['desktop', 1280, 800]];

const geometry = (page) => page.evaluate(() => {
  const pop = document.querySelector('.menu-pop').getBoundingClientRect(), z = (s) => getComputedStyle(document.querySelector(s));
  return { overflowX: document.documentElement.scrollWidth - innerWidth, left: pop.left, right: pop.right, top: pop.top, bottom: pop.bottom, vw: innerWidth, vh: innerHeight,
    rows: [...document.querySelectorAll('.menu-item')].map(e => Math.round(e.getBoundingClientRect().height)), scrim: !!document.querySelector('.menu-scrim') && z('.menu-scrim').display !== 'none', popZ: z('.menu-pop').zIndex };
});

async function exercise(page, w, label, items) {
  const btn = page.locator('.menu-btn');
  assert.equal(await btn.getAttribute('aria-haspopup'), 'menu'); assert.equal(await btn.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('.topbar #out, .topbar .btn, .hide-phone').count(), 0, `${label}: the bar holds only the brand, the chip and the menu`);
  // open by click, close by outside click
  await btn.click(); await page.waitForSelector('.menu-pop [role=menu] [role=menuitem]'); assert.equal(await btn.getAttribute('aria-expanded'), 'true');
  await page.waitForTimeout(400); const g = await geometry(page); assert.ok(g.overflowX <= 1, `${label}: page scrolls sideways`); assert.ok(g.left >= 0 && g.right <= g.vw && g.top >= 0 && g.bottom <= g.vh, `${label}: the menu stays inside the screen`);
  assert.ok(g.rows.every(h => h >= 44), `${label}: rows are at least 44px: ${g.rows}`); assert.equal(g.scrim, w <= 640, `${label}: scrim only on phones`);
  if (w <= 640) { assert.ok(Math.abs(g.bottom - g.vh) <= 1 && g.left === 0 && g.right === g.vw, `${label}: a bottom sheet on phones`); }
  assert.deepEqual(await page.locator('.menu-item').allTextContents(), items, `${label}: entries`);
  assert.ok(await page.locator('.menu-head b').textContent());
  await page.mouse.click(w / 2, 5); await page.waitForSelector('.menu-pop', { state: 'detached' }); assert.equal(await btn.getAttribute('aria-expanded'), 'false');
  // Escape closes and returns focus to the button
  await btn.click(); await page.waitForSelector('.menu-pop'); await page.keyboard.press('Escape'); await page.waitForSelector('.menu-pop', { state: 'detached' }); assert.ok(await btn.evaluate(e => e === document.activeElement), `${label}: focus returns to the button`);
  // keyboard: ArrowDown on the button opens, arrows move, Home/End jump
  await page.keyboard.press('ArrowDown'); await page.waitForSelector('.menu-pop');
  const focusedText = () => page.evaluate(() => document.activeElement.textContent);
  assert.equal(await focusedText(), items[0]); await page.keyboard.press('End'); assert.equal(await focusedText(), items.at(-1)); await page.keyboard.press('Home'); assert.equal(await focusedText(), items[0]);
  if (items.length > 1) { await page.keyboard.press('ArrowDown'); assert.equal(await focusedText(), items[1]); await page.keyboard.press('ArrowUp'); assert.equal(await focusedText(), items[0]); }
  await page.keyboard.press('Escape'); await page.waitForSelector('.menu-pop', { state: 'detached' });
}

test('browser: reseller account menu at phone, tablet and desktop sizes; Site admin only when linked; Sign out works', { skip, timeout: 300000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), ctx = await br.newContext({ viewport: { width: 375, height: 812 } }), page = await ctx.newPage();
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Menu Co'); await page.fill('#em', 'm@example.com'); await page.fill('#un', 'mona'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'mona@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.menu-btn');
    for (const [name, w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, `${name}: the top bar fits`);
      await exercise(page, w, `reseller ${name}`, ['Sign out']);
      if (w !== 768) { await page.locator('.menu-btn').click(); await page.waitForSelector('.menu-pop'); await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}/menu-app-${w}.png` }); await page.keyboard.press('Escape'); }
    }
    // The More sheet is navigation only.
    await page.setViewportSize({ width: 375, height: 812 }); await page.click('[data-more]'); await page.waitForSelector('.sheet-menu');
    assert.equal(await page.locator('.sheet').getByText('Sign out').count(), 0, 'Sign out is not in the More sheet'); await page.keyboard.press('Escape'); await page.waitForSelector('.scrim', { state: 'detached' });
    // A linked account shows Site admin (the signed-in profile is flagged for this check; the server side is covered by e2e-hostlink) and it opens the Host Console in a new tab.
    await page.setViewportSize({ width: 1280, height: 800 }); await page.evaluate(() => { AccountApp.me.hostLinked = true; AccountApp.showShell(); }); await page.waitForSelector('.menu-btn');
    await exercise(page, 1280, 'reseller linked', ['Site admin', 'Sign out']);
    await page.locator('.menu-btn').click(); const [pop] = await Promise.all([ctx.waitForEvent('page'), page.locator('.menu-item', { hasText: 'Site admin' }).click()]);
    assert.match(pop.url(), /\/host\/$/); await pop.close(); await page.waitForSelector('.menu-pop', { state: 'detached' });
    // Sign out
    await page.locator('.menu-btn').click(); await page.locator('.menu-item', { hasText: 'Sign out' }).click(); await page.waitForSelector('#l'); assert.equal(await page.locator('.menu-btn').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});

test('browser: Host Console account menu', { skip, timeout: 300000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 375, height: 812 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.menu-btn');
    for (const [name, w, h] of SIZES) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(150); await exercise(page, w, `host ${name}`, ['Sign out']);
      if (w !== 768) { await page.locator('.menu-btn').click(); await page.waitForSelector('.menu-pop'); await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}/menu-host-${w}.png` }); await page.keyboard.press('Escape'); } }
    await page.locator('.menu-btn').click(); await page.locator('.menu-item', { hasText: 'Sign out' }).click(); await page.waitForSelector('#u'); assert.equal(await page.locator('.menu-btn').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
