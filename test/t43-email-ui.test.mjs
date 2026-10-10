// TEST / t43-email-ui — in the browser at laptop and phone widths: "Send test email" shows the plain cause and next step with "Show details" hidden until asked,
// "Check my email setup" shows a tick per step, the last test is remembered, the password never appears, 44px buttons and no sideways scroll.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { startServer, sleep } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw, skip = false; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch { skip = 'playwright not installed'; } }
const PW = 'Sup3rSecretPass!', MAILPW = 'Rel4y-S3cret-pw!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';

test('Email page: failure message, details toggle, step ticks and last test at 1280px and 375px', { skip: skip || (!sqlite && 'SQLite-only'), timeout: 240000 }, async () => {
  const fake = net.createServer((s) => { s.write('220 fake\r\n'); s.on('data', (b) => { for (const l of String(b).split('\r\n').filter(Boolean)) { const c = l.toUpperCase(); if (c.startsWith('EHLO')) s.write('250-fake\r\n250 AUTH PLAIN\r\n'); else if (c.startsWith('AUTH')) s.write(`535 5.7.8 Username and Password not accepted ${MAILPW}\r\n`); else s.write('250 ok\r\n'); } }); s.on('error', () => {}); });
  await new Promise(r => fake.listen(0, '127.0.0.1', r)); const port = fake.address().port;
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const noSideways = async (what) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${what}: no sideways scroll`);
  const tall = async (sel, what) => { for (const h of await page.$$eval(sel, els => els.filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height))) assert.ok(h >= 43.5, `${what}: ${h}px tall`); };
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('main');
    await page.goto(srv.base + '/host/#/email'); await page.waitForSelector('#en'); await sleep(300);
    await page.evaluate(async ({ port, pass }) => { const csrf = (await (await fetch('/api/host/me')).json()).csrf; await fetch('/api/host/mail', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ enabled: true, mode: 'smtp', fromName: 'Site', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', port, secure: false, user: 'relayuser', pass } }) }); }, { port, pass: MAILPW });
    await page.goto(srv.base + '/host/#/overview'); await page.waitForSelector('main'); await sleep(500);
    assert.match(await page.textContent('main'), /no test email has passed/i, 'the Overview warns until a test passes');
    await page.goto(srv.base + '/host/#/email'); await page.waitForSelector('#test'); await sleep(400);
    assert.equal(await page.isVisible('#untested'), true); assert.match(await page.textContent('#lasttest'), /No test has been run yet/);
    for (const w of [1280, 375]) {
      await page.setViewportSize({ width: w, height: 900 }); await sleep(250);
      await page.fill('#to', 'owner@example.com'); await page.click('#test'); await page.waitForSelector('#testres .chip.red'); await sleep(200);
      assert.match(await page.textContent('#testres'), /The mail server refused the sign-in/); assert.match(await page.textContent('#testres'), /Next:/);
      assert.equal(await page.isHidden('#tdetbox'), true, 'details are hidden until asked'); assert.equal(await page.getAttribute('#tdet', 'aria-expanded'), 'false');
      await page.click('#tdet'); assert.equal(await page.isVisible('#tdetbox'), true); assert.equal(await page.getAttribute('#tdet', 'aria-expanded'), 'true'); assert.match(await page.textContent('#tdetbox'), /535/);
      await page.click('#check'); await page.waitForSelector('#testres .setting .chip.green'); await sleep(200);
      const chips = (await page.$$eval('#testres .setting .chip', els => els.map(e => e.textContent.trim())));
      assert.deepEqual(chips.slice(0, 4), ['Not sent', '✓ Passed', '✓ Passed', '✗ Failed'].slice(0, 1).concat(['✓ Passed', '✓ Passed', '✗ Failed']), 'settings, connection passed; sign-in failed: ' + chips.join('|'));
      assert.match(await page.textContent('#lasttest'), /Last test .* did not pass/);
      if (w === 375) await tall('#test, #check', 'test buttons'); await noSideways(`Email at ${w}px`);
    }
    assert.ok(!(await page.content()).includes(MAILPW), 'the mail password is nowhere on the page');
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); fake.close(); }
});
