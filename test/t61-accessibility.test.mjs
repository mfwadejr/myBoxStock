// TEST / t61-accessibility — a real browser: the axe-core checker finds nothing on any reseller or Host screen (laptop and phone), and the keyboard works on sheets and dropdowns.
// axe-core is a development-only package; without it the checker part is skipped (the keyboard part still runs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, Client } from './helpers.mjs';
import { pw, skip, PW, launch, signUp } from './helpers-ui.mjs';

let axeSrc = null; for (const p of ['../node_modules/axe-core/axe.min.js', '/tmp/axe/node_modules/axe-core/axe.min.js']) { try { axeSrc = fs.readFileSync(new URL(p, import.meta.url), 'utf8'); break; } catch {} }
const skipAxe = skip || (axeSrc ? false : 'axe-core is not installed (npm install, development packages)');
const RESELLER = ['home', 'sell', 'inventory', 'customers', 'sales', 'reports', 'team', 'settings', 'backup', 'activity', 'security', 'docs', 'support'];
const HOST = ['overview', 'alerts', 'accounts', 'support', 'pipeline', 'onboarding', 'plans', 'backups', 'email', 'firewall', 'security', 'settings', 'logs', 'audit', 'retention', 'demo', 'updates', 'docs'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const settle = async (page) => { await page.waitForFunction(() => (document.querySelector('.main')?.innerText || '').trim().length > 20, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(450); };
const scan = async (page, where, bad) => {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(async (tags) => await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }), TAGS);
  for (const v of r.violations) bad.push(`${where}: ${v.id} (${v.nodes.length}) e.g. ${v.nodes[0].target.join(' ')}`);
};
const quiet = async (srv) => { const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW }); await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 }); };

test('browser: axe finds nothing on the reseller screens and common sheets, laptop and phone', { skip: skipAxe, timeout: 420000 }, async () => {
  const srv = await startServer(); await quiet(srv); const br = await launch(); const bad = [];
  try {
    for (const [w, h] of [[1280, 900], [390, 844]]) {
      const { page, ctx } = await signUp(srv, br, { width: w, height: h, user: 'axe' + w });
      await page.evaluate(async () => { await AccountApp.store.commit({ puts: [{ type: 'customer', data: { name: 'Zed Buyer', phone: '555-0100', email: 'zed@example.com', notes: '', createdAt: Date.now() } }, ...[1, 2].map(i => ({ type: 'item', data: { uid: 'Q-' + i, make: 'Roku', model: 'Ultra 4800', status: 'in_stock', cost: 2000, createdAt: Date.now() } }))] }); });
      for (const k of RESELLER) { await page.evaluate((x) => { location.hash = x; }, '#/' + k); await settle(page); await scan(page, `${w}px app/${k}`, bad); }
      await page.evaluate(() => { location.hash = '#/inventory'; }); await settle(page); await page.click('#add'); await page.waitForSelector('.sheet'); await page.waitForTimeout(300); await scan(page, `${w}px sheet: add device`, bad);
      await ctx.close();
    }
    assert.deepEqual(bad, [], 'accessibility problems found:\n' + bad.join('\n'));
  } finally { await br.close(); await srv.stop(); }
});

test('browser: axe finds nothing on the Host screens, laptop and phone', { skip: skipAxe, timeout: 420000 }, async () => {
  const srv = await startServer(); await quiet(srv); const br = await launch(); const bad = [];
  try {
    for (const [w, h] of [[1280, 900], [390, 844]]) {
      const page = await br.newPage({ viewport: { width: w, height: h } }); page.setDefaultTimeout(15000);
      await page.goto(srv.base + '/host/'); await page.waitForSelector('#u'); await page.fill('#u', 'admin'); await page.fill('#p', PW); await page.click('#go'); await page.waitForSelector('.main');
      for (const k of HOST) { await page.evaluate((x) => { location.hash = x; }, '#/' + k); await settle(page); await scan(page, `${w}px host/${k}`, bad); }
      await page.close();
    }
    assert.deepEqual(bad, [], 'accessibility problems found:\n' + bad.join('\n'));
  } finally { await br.close(); await srv.stop(); }
});

test('browser: keyboard only: sheets keep focus inside, Escape closes them and focus goes back; dropdowns open and choose with the keys; focus is visible', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await launch();
  try {
    const { page } = await signUp(srv, br, { user: 'kbd' }); await page.evaluate(() => { location.hash = '#/inventory'; }); await page.waitForSelector('#add');
    // The Add device sheet: opens, focus inside, Tab never leaves, Escape closes, focus returns to the button.
    await page.focus('#add'); await page.keyboard.press('Enter'); await page.waitForSelector('.sheet');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('.sheet')), 'focus moves into the sheet');
    for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('.sheet')), `focus stayed inside the sheet after ${i + 1} Tabs`); }
    await page.keyboard.press('Shift+Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('.sheet')), 'Shift+Tab stays inside too');
    // A dropdown inside the sheet: Enter opens, arrows move, Enter chooses, and the first Escape closes only the list.
    await page.focus('#f_cond'); await page.keyboard.press('Enter'); await page.waitForSelector('.select.open');
    await page.keyboard.press('ArrowDown'); const choice = await page.evaluate(() => document.activeElement.textContent); await page.keyboard.press('Enter');
    assert.equal(await page.textContent('#f_cond .select-label'), choice, 'the key-chosen option is shown'); assert.equal(await page.locator('.select.open').count(), 0, 'the list closed');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    assert.equal(await page.locator('.sheet').count(), 0, 'Escape closes the sheet'); assert.equal(await page.evaluate(() => document.activeElement.id), 'add', 'focus goes back to Add device');
    // Focus is visible: a focused button gets an outline or ring from the stylesheet.
    await page.focus('#add'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== 'none' }; });
    assert.ok(ring.outline || ring.shadow, 'a focused control shows a focus ring');
    // Names: every dropdown and checkbox on this screen has one.
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('.select-btn, input:not([type=hidden])')].filter(e => e.getClientRects().length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && ![...(e.labels || [])].some(l => l.textContent.trim())).map(e => e.id || e.className));
    assert.deepEqual(unnamed, [], 'controls without a name');
  } finally { await br.close(); await srv.stop(); }
});
