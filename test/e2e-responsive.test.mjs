// TEST / e2e-responsive — every screen works on the common phone, tablet, laptop and desktop sizes:
// nothing scrolls sideways, the right menu shows (tab bar on phones and tablets, side menu beyond), touch targets are 44px, fields are 16px, tables become cards on phones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';
const SIZES = [
  ['iPhone SE', 375, 667], ['iPhone 15', 390, 844], ['iPhone 15 Pro Max', 430, 932], ['iPhone landscape', 844, 390], ['Android small', 360, 800], ['Android large', 412, 915],
  ['iPad portrait', 768, 1024], ['iPad Air portrait', 820, 1180], ['iPad landscape', 1024, 768], ['iPad Pro 12.9', 1024, 1366], ['Laptop', 1280, 800], ['Desktop', 1920, 1080],
];
const APP = ['home', 'sell', 'inventory', 'customers', 'sales', 'team', 'settings', 'activity', 'security', 'docs'];
const HOST = ['overview', 'alerts', 'accounts', 'pipeline', 'plans', 'backups', 'email', 'firewall', 'security', 'settings', 'logs', 'docs'];

// What to verify on the page as it is now.
const inspect = (w) => `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const out = { overflow: document.documentElement.scrollWidth - innerWidth, small: [], zoomy: [], tableNotCards: 0 };
  const touch = ${w} <= 820;
  const side = document.querySelector('.side'), bar = document.querySelector('.tabbar');
  out.side = !!side && vis(side); out.bar = !!bar && vis(bar);
  if (touch) {
    for (const e of document.querySelectorAll('.main .btn, .main .select-btn, .main input:not([type=checkbox]):not([type=radio]):not([type=file]), .main .seg button, .tabbar a, .tabbar button, .topbar .btn')) {
      if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.height < 43.5) out.small.push((e.className || e.tagName) + ':' + Math.round(r.height));
    }
    for (const e of document.querySelectorAll('.main input:not([type=checkbox]):not([type=radio]):not([type=file]), .main textarea')) if (vis(e) && parseFloat(getComputedStyle(e).fontSize) < 16) out.zoomy.push(e.id || e.type);
  }
  if (${w} <= 640) for (const t of document.querySelectorAll('.main table')) if (vis(t) && getComputedStyle(t.querySelector('thead') || t).display !== 'none' && t.querySelector('thead')) out.tableNotCards++;
  return out;
})()`;
// Many page loads from one address are normal here; switch the request limit off so it cannot interfere.
const relax = async (srv) => { const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW }); await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 }); };
const wait = async (page, sel, label) => { try { await page.waitForSelector(sel, { timeout: 8000 }); } catch (e) { throw new Error(`${label}: "${sel}" never showed. The page says: ${(await page.evaluate(() => document.body.innerText).catch(() => '?')).slice(0, 300)} | ${page.url()}`); } };
const check = (label, w, r) => {
  assert.ok(r.overflow <= 1, `${label}: the page scrolls sideways by ${r.overflow}px`);
  if (w <= 820) { assert.ok(r.bar, `${label}: the tab bar shows`); assert.ok(!r.side, `${label}: the side menu is hidden`); } else { assert.ok(r.side, `${label}: the side menu shows`); assert.ok(!r.bar, `${label}: the tab bar is hidden`); }
  assert.deepEqual(r.small, [], `${label}: controls under 44px`); assert.deepEqual(r.zoomy, [], `${label}: fields under 16px (iPhones zoom in)`); assert.equal(r.tableNotCards, 0, `${label}: tables should be cards on phones`);
};

test('browser: reseller app at phone, tablet, laptop and desktop sizes', { skip, timeout: 600000 }, async () => {
  const srv = await startServer(); await relax(srv); const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), ctx = await br.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage();
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Resp Co'); await page.fill('#em', 'r@example.com'); await page.fill('#un', 'rae'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, 'rae@' + id); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.main');
    await page.evaluate(async () => { const S = AccountApp.store;
      await S.commit({ puts: [{ type: 'customer', data: { name: 'Zed Buyer', phone: '555-0100', email: 'zed@example.com', notes: '', createdAt: Date.now() } }, ...[1, 2, 3].map(i => ({ type: 'item', data: { uid: 'Q-' + i, make: 'Roku', model: 'Ultra 4800', status: 'available', cost: 10000, price: 34000, addedAt: Date.now() } }))] });
      await S.commit({ puts: [{ type: 'sale', data: { no: 'S-TEST-0001', ts: Date.now(), customerName: 'Zed Buyer', items: [{ make: 'Roku', model: 'Ultra', uid: 'U-1', price: 5000 }], subtotal: 5000, total: 5000, cost: 2000, payment: 'cash' } }] }); });
    for (const [name, w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      for (const k of APP) { await page.goto(srv.base + '/app/#/' + k); await wait(page, '.main h1, .main .page-head', `${name} app/${k}`); await page.waitForTimeout(250); check(`${name} (${w}x${h}) app/${k}`, w, await page.evaluate(inspect(w))); }
    }
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});

test('browser: Host Console at phone, tablet, laptop and desktop sizes, and the More menu works', { skip, timeout: 600000 }, async () => {
  const srv = await startServer(); await relax(srv); const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input'); const ins = await page.$$('input'); await ins[0].fill('admin'); await ins[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');
    for (const [name, w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      for (const k of HOST) { await page.goto(srv.base + '/host/#/' + k); await wait(page, '.main h1, .main .page-head', `${name} host/${k}`); await page.waitForTimeout(250); check(`${name} (${w}x${h}) host/${k}`, w, await page.evaluate(inspect(w))); }
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(srv.base + '/host/#/overview'); await page.waitForSelector('[data-more]');
    await page.click('[data-more]'); await page.waitForSelector('.sheet-menu a'); assert.ok(await page.locator('.sheet-menu a').count() >= 8, 'More lists the rest of the menu');
    await page.click('.sheet-menu a[data-k=firewall]'); await page.waitForSelector('#hadd'); await page.waitForFunction(() => !document.querySelector('.scrim'), null, { timeout: 3000 });
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});

test('browser: sign-in and sign-up pages fit every size', { skip, timeout: 300000 }, async () => {
  const srv = await startServer(); await relax(srv); const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage();
  try {
    for (const [name, w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      for (const url of ['/app/', '/host/']) { await page.goto(srv.base + url); await wait(page, 'input', `${name} ${url}`); const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(o <= 1, `${name} ${url}: scrolls sideways by ${o}px`); }
      await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]'); const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(o <= 1, `${name} sign-up: scrolls sideways by ${o}px`);
    }
  } finally { await br.close(); await srv.stop(); }
});
