// TEST / e2e-messages — a real browser: Host Console → Email → Messages. Edit wording, live preview (styled / plain text, desktop / phone), rules, save, reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;

test('browser: Messages tab edits wording with a live preview', { skip, timeout: 120000 }, async () => {
  const srv = await startServer(), api = new Client(srv.base);
  await api.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await api.req('POST', '/api/host/change-password', { current: srv.hostPw, next: 'Sup3rSecretPass!' });
  const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), ctx = await br.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addCookies(Object.entries(api.jar).map(([name, value]) => ({ name, value, url: srv.base })));
  const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/host/#/email'); await page.waitForSelector('#etabs');
    assert.equal(await page.locator('#save').count(), 1, 'Delivery tab shows by default (it has its own Save)');
    await page.click('#etabs [data-t=messages]'); await page.waitForSelector('#sub'); await page.waitForSelector('#fr');
    assert.equal(await page.locator('#dv').isVisible(), true, 'Desktop/Phone shows for the styled view');

    // pick the password reset message; the styled preview is a real page showing the heading and the button
    await page.click('#mk'); await page.click('.select-option[data-value=password_reset]');
    await page.waitForSelector('#btn'); await page.fill('#body', 'Hi {{name}},\n\nCustom words for the reset.'); await page.fill('#btn', 'Pick a password');
    await page.waitForFunction(() => document.querySelector('#psub')?.textContent.includes('Reset your myBoxStock password'));
    await page.waitForTimeout(600);
    const fr = page.frameLocator('#fr'); await fr.locator('h1').waitFor();
    assert.match(await fr.locator('body').textContent(), /Custom words for the reset\./); assert.equal(await fr.locator('a').textContent(), 'Pick a password');
    assert.equal(await fr.locator('img').evaluate(i => i.naturalWidth > 0), true, 'the logo loads in the preview');

    // plain text view shows exactly the text version, including the link; Desktop/Phone hides for it
    await page.click('#vw [data-v=text]'); await page.waitForSelector('#ptext');
    const text = await page.textContent('#ptext'); assert.ok(text.includes('Custom words for the reset.') && text.includes('Pick a password: https://') && text.includes('— myBoxStock'));
    assert.equal(await page.locator('#dv').isVisible(), false);
    await page.click('#vw [data-v=styled]'); await page.click('#dv [data-d=phone]'); await page.waitForSelector('#fr.phone');
    const w = (await page.locator('#fr').boundingBox()).width; assert.ok(w <= 376 && w >= 300, 'phone width');

    // a placeholder chip inserts at the cursor; a required one cannot be dropped
    await page.click('#mk'); await page.click('.select-option[data-value=welcome]'); await page.waitForSelector('.sheet #ok'); await page.click('.sheet #ok'); // discard prompt (unsaved changes)
    await page.waitForSelector('[data-ph=username]'); await page.fill('#sub', 'Welcome'); await page.fill('#body', 'Hello'); await page.click('[data-ph=name]');
    assert.equal(await page.inputValue('#body'), 'Hello{{name}}');
    await page.waitForFunction(() => document.querySelector('#prob')?.textContent.includes('{{accountCode}}')); assert.equal(await page.locator('#save').isDisabled(), true, 'Save is off while a required detail is missing');
    await page.fill('#body', 'Hello {{name}}, your ID is {{accountCode}}'); await page.waitForFunction(() => !document.querySelector('#save').disabled);

    // save, see it marked as edited, reset to the default
    await page.click('#save'); await page.waitForFunction(() => document.querySelector('#mk .select-label')?.textContent.includes('(edited)')); assert.equal(await page.locator('#reset').isDisabled(), false);
    await page.click('#reset'); await page.waitForSelector('.sheet #ok'); await page.click('.sheet #ok');
    await page.waitForFunction(() => !document.querySelector('#mk .select-label')?.textContent.includes('(edited)'));
    assert.match(await page.inputValue('#body'), /Your account is ready\./);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
