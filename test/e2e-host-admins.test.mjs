// TEST / e2e-host-admins — a real browser: Security page shows the Owner, Edit sheet, and hides Owner-only actions from helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const STRONG = 'Sup3rSecretPass!', HELPER = 'H3lperSecretPass!';

test('browser: Owner chip, edit details, support actions only for the Owner', { skip, timeout: 120000 }, async () => {
  const srv = await startServer(), owner = new Client(srv.base), helper = new Client(srv.base);
  await owner.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await owner.req('POST', '/api/host/change-password', { current: srv.hostPw, next: STRONG });
  await owner.req('POST', '/api/host/admins', { username: 'helper', email: 'helper@example.com', password: 'Temp0rarySecret!' });
  await helper.req('POST', '/api/host/login', { login: 'helper', password: 'Temp0rarySecret!' }); await helper.req('POST', '/api/host/change-password', { current: 'Temp0rarySecret!', next: HELPER });
  const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
  const open = async (client) => { const ctx = await br.newContext({ viewport: { width: 1400, height: 1000 } }); await ctx.addCookies(Object.entries(client.jar).map(([name, value]) => ({ name, value, url: srv.base }))); const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.goto(srv.base + '/host/#/security'); await page.waitForSelector('[data-edit]'); return page; };
  const errors = [];
  try {
    const page = await open(owner), hp = await open(helper); // helper's page is opened first: the Owner's temporary-password step below ends their session
    assert.equal(await page.locator('.chip', { hasText: 'Owner' }).count(), 1, 'exactly one Owner chip');
    assert.match(await page.locator('tbody tr').first().textContent(), /Owner/);
    assert.equal(await page.locator('#addadm').count(), 1); assert.equal(await page.locator('[data-rm]').count(), 1, 'Delete shows for the helper only');
    await page.locator('tr', { hasText: 'helper' }).locator('[data-edit]').click(); await page.waitForSelector('.sheet #mfa');
    await page.fill('.sheet #n', 'Hal Helper'); await page.fill('.sheet #c', '555 010 2030'); await page.click('.sheet #go');
    await page.waitForFunction(() => document.body.textContent.includes('Hal Helper') && document.body.textContent.includes('555 010 2030'));
    await page.locator('tr', { hasText: 'helper' }).locator('[data-edit]').click(); await page.waitForSelector('.sheet #tmp'); await page.click('.sheet #tmp'); await page.waitForSelector('.sheet #ok'); await page.click('.sheet #ok');
    await page.waitForSelector('.sheet .codeblock'); assert.ok((await page.textContent('.sheet .codeblock')).trim().length >= 10, 'temporary password is shown once');
    await page.click('.sheet [data-cancel]');

    // the helper sees no Owner-only controls and can edit only their own row
    assert.equal(await hp.locator('#addadm').count(), 0); assert.equal(await hp.locator('[data-rm]').count(), 0); assert.equal(await hp.locator('[data-edit]').count(), 1, 'only their own Edit');
    await hp.click('[data-edit]'); await hp.waitForSelector('.sheet #go'); assert.equal(await hp.locator('.sheet #mfa').count(), 0, 'no support actions for helpers');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
