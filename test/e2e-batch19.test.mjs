// TEST / e2e-batch19 — the new Host Console pages render, the alert banner shows, and a helper without two-factor is walked through setting it up.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, fillLogin } from './helpers.mjs';

const pwPath = '/opt/npm-tools/node_modules/playwright/index.mjs', exe = '/opt/pw-browsers/chromium';
let pw, skip = false; try { pw = await import(pwPath); } catch { skip = 'playwright not installed'; }
const PW = 'Sup3rSecretPass!';

test('browser: Alerts, Onboarding, Audit trail, Updates and Email health pages work', { skip, timeout: 150000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    const { DatabaseSync } = await import('node:sqlite');
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.side');
    const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000');
    d.prepare("INSERT INTO mail_queue (id,to_addr,subject,body_text,body_html,status,attempts,last_error,created_at) VALUES ('f1','x@example.com','S','t','h','failed',5,'Connection refused',?)").run(Date.now()); d.close();
    const links = await page.$$eval('.side a', a => a.map(x => x.dataset.k)); for (const k of ['alerts', 'onboarding', 'audit', 'updates']) assert.ok(links.includes(k), 'menu has ' + k);
    await page.goto(srv.base + '/host/#/alerts'); await page.waitForSelector('#chk'); await page.click('#chk');
    await page.waitForSelector('text=Email is not being delivered'); assert.match(await page.textContent('main'), /seen|emailed|Needs a look/);
    await page.goto(srv.base + '/host/#/overview'); await page.waitForSelector('#alertbar'); assert.match(await page.textContent('#alertbar'), /1 problem needs a look/);
    await page.goto(srv.base + '/host/#/onboarding'); await page.waitForSelector('text=Setup funnel');
    await page.goto(srv.base + '/host/#/audit'); await page.waitForSelector('#q'); await page.waitForSelector('text=Audit trail');
    await page.goto(srv.base + '/host/#/updates'); await page.waitForSelector('text=Running version'); assert.match(await page.textContent('main'), /Release address/);
    await page.goto(srv.base + '/host/#/email'); await page.waitForSelector('#etabs'); await page.click('#etabs [data-t=health]'); await page.waitForSelector('text=Is email getting out?'); assert.match(await page.textContent('main'), /Waiting to send/);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});

test('browser: a helper administrator must set up two-factor before using the console', { skip, timeout: 150000 }, async () => {
  const srv = await startServer(), host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('POST', '/api/host/admins', { username: 'helper', email: 'h@example.com', password: 'Temp0rarySecret!' });
  const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(20000);
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('helper'); await inputs[1].fill('Temp0rarySecret!'); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', 'Temp0rarySecret!'); await page.fill('#b', 'H3lperSecretPass!'); await page.click('#go');
    await page.waitForSelector('text=Set up two-factor'); assert.match(await page.textContent('#root'), /Every administrator needs an authenticator app/);
    assert.equal(await page.$('.side'), null, 'no console menu is shown yet');
  } finally { await br.close(); await srv.stop(); }
});

test('browser: the Documentation link opens in both consoles, searches, and shows a page', { skip, timeout: 200000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    // reseller console
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Docs Co'); await page.fill('#em', 'd@example.com'); await page.fill('#un', 'dana'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, 'dana@' + id); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.click('.side a[data-k=docs]'); await page.waitForSelector('#dq'); assert.match(await page.textContent('main'), /Getting started/);
    await page.fill('#dq', 'recovery key'); await page.waitForSelector('#dres .doc-hit'); assert.ok(await page.locator('#dres .doc-hit').count() >= 1);
    await page.click('#dres .doc-hit >> nth=0'); await page.waitForSelector('.doc h2'); assert.ok(await page.locator('.doc-toc a').count() >= 14);
    assert.doesNotMatch(await page.textContent('main'), /Host Console/i, 'the reseller set does not describe the Host Console');
    // host console
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.side');
    await page.click('.side a[data-k=docs]'); await page.waitForSelector('#dq'); await page.fill('#dq', 'cloudflare'); await page.waitForSelector('#dres .doc-hit');
    await page.click('#dres .doc-hit >> nth=0'); await page.waitForSelector('.doc h2'); assert.ok(await page.locator('.doc-toc a').count() >= 18);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
