// TEST / t40-signin-legal-and-reset — the four legal links are short (Terms, Privacy, Data use, Billing) with the full title as tooltip, one component everywhere,
// a 2x2 block on a phone and one row on a laptop with 44px targets and no sideways scroll; the reset screens say what stays locked; the reset reply is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { startServer, Client, ROOT, sleep } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw, skip = false; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch { skip = 'playwright not installed'; } }
const NOTE = 'Resetting your password gets you back into your login. Your business data stays locked until you enter your recovery key or an Administrator unlocks it for you.';
const PW = 'Sup3rSecretPass!';

test('the legal links component: short labels, correct addresses, full titles as tooltips, same markup for every screen', () => {
  const ctx = { UI: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/js/shared/legal.js'), 'utf8'), ctx);
  const L = ctx.UI.legal, grab = (html) => [...html.matchAll(/<a href="([^"]+)" title="([^"]+)"([^>]*)>([^<]+)<\/a>/g)].map(m => ({ href: m[1], title: m[2], label: m[4], extra: m[3] }));
  const app = grab(L.links(false, true)), host = grab(L.links(true));
  assert.deepEqual(app.map(a => a.label), ['Terms', 'Privacy', 'Data use', 'Billing']);
  assert.deepEqual(app.map(a => a.title), ['Terms of Service', 'Privacy Policy', 'Data responsibility and acceptable use', 'Billing, trial and refund terms']);
  assert.deepEqual(app.map(a => a.href), ['#/legal/terms-of-service', '#/legal/privacy-policy', '#/legal/data-responsibility-and-acceptable-use', '#/legal/billing-trial-and-refund-terms']);
  assert.deepEqual(host.map(a => a.href), ['/legal/terms-of-service', '/legal/privacy-policy', '/legal/data-responsibility-and-acceptable-use', '/legal/billing-trial-and-refund-terms']);
  assert.ok(app.every(a => /_blank/.test(a.extra)) && host.every(a => /_blank/.test(a.extra)));
  assert.match(L.footer(true), /<footer class="legal-foot"><nav class="legal-links" aria-label="Legal">/);
  assert.deepEqual(Array.from(L.pages.slice(0, 2), p => p[1]), ['Terms of Service', 'Privacy Policy'], 'the full titles stay available to the legal pages');
  for (const f of ['public/js/app/main.js', 'public/js/host/main.js']) assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), /UI\.legal\.(links|footer)/, f + ' uses the shared component');
});

test('the links are styled from tokens only: grid on a phone, a row on a laptop, tap size kept', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/css/layout.css'), 'utf8');
  assert.match(css, /\.legal-links \{[^}]*display: grid;[^}]*repeat\(2, auto\)/); assert.match(css, /@media \(min-width: 641px\) \{ \.legal-links \{ display: flex/); assert.match(css, /\.legal-links a \{[^}]*min-height: var\(--tap-min\)/);
  assert.ok(!/\.legal-links[^}]*\d+px/.test(css.replace(/@media[^{]*\{/g, '')), 'no raw lengths in the rules');
});

test('the reset reply is the same for a known and an unknown email, and the flow still works', { timeout: 120000 }, async () => {
  const srv = await startServer(); try {
    const c = new Client(srv.base); assert.equal((await c.req('POST', '/api/app/signup', { businessName: 'Reset Boxes', email: 'reset@example.com', username: 'rita', password: PW })).status, 200);
    const known = await new Client(srv.base).req('POST', '/api/app/forgot', { email: 'reset@example.com' }), unknown = await new Client(srv.base).req('POST', '/api/app/forgot', { email: 'nobody@example.com' });
    assert.equal(known.status, 200); assert.deepEqual(known.data, unknown.data); assert.deepEqual(known.data, { ok: true });
    assert.equal((await new Client(srv.base).req('GET', '/api/app/public-config')).data.emailReady, false, 'the site says only whether it can send email, nothing about accounts');
    assert.equal((await new Client(srv.base).req('POST', '/api/app/reset', { token: 'not-a-real-token', password: PW + 'x1' })).status >= 400, true);
  } finally { srv.stop(); }
});

test('browser: Host sign-in and app sign-in show the short links in a tidy block; reset screens carry the new wording', { skip, timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 375, height: 800 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const block = () => page.$$eval('.legal-links a', as => as.filter(a => a.offsetParent).map(a => { const r = a.getBoundingClientRect(); return { t: a.textContent, top: Math.round(r.top), left: Math.round(r.left), w: r.width, h: r.height, title: a.title }; }));
  const noSideways = async (what) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${what}: no sideways scroll`);
  try {
    for (const [url, what] of [['/app/', 'sign-in'], ['/host/', 'Host sign-in']]) {
      await page.goto(srv.base + url); await page.waitForSelector('.legal-links a'); await sleep(300);
      let links = await block(); assert.deepEqual(links.map(l => l.t), ['Terms', 'Privacy', 'Data use', 'Billing'], what);
      assert.deepEqual(links.map(l => l.title), ['Terms of Service', 'Privacy Policy', 'Data responsibility and acceptable use', 'Billing, trial and refund terms']);
      assert.equal(new Set(links.map(l => l.top)).size, 2, `${what}: a 2x2 block (two rows) on a phone`); assert.ok(links.every(l => l.h >= 43.5 && l.w >= 43.5), `${what}: 44px targets`); await noSideways(what + ' at 375px');
      await page.setViewportSize({ width: 1280, height: 800 }); await sleep(250); links = await block(); assert.equal(new Set(links.map(l => l.top)).size, 1, `${what}: one row on a laptop`); await noSideways(what + ' at 1280px'); await page.setViewportSize({ width: 375, height: 800 });
    }
    await page.goto(srv.base + '/app/'); await page.waitForSelector('#fg'); await page.click('#fg'); await page.waitForSelector('#resetnote');
    assert.equal((await page.textContent('#resetnote')).trim(), NOTE); assert.equal(await page.isVisible('#nomail'), true, 'Email is not set up on this test site, so the sign-in screen says so without naming any account');
    assert.match(await page.textContent('#nomail'), /cannot send email right now/); await noSideways('Forgot at 375px');
    await page.goto(srv.base + '/app/#/reset/sometoken'); await page.waitForSelector('#resetnote'); assert.equal((await page.textContent('#resetnote')).trim(), NOTE);
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});

test('browser: after a reset the confirmation screen says the data stays locked until the recovery key or an Administrator', { skip, timeout: 120000 }, async () => {
  const { sha256 } = await import('../src/core/ids.mjs'), { DatabaseSync } = await import('node:sqlite');
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 375, height: 800 } }); page.setDefaultTimeout(20000);
  const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000');
  try {
    assert.equal((await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Locked Boxes', email: 'locked@example.com', username: 'lena', password: PW })).status, 200);
    const u = d.prepare("SELECT id FROM account_users WHERE username = 'lena'").get(), raw = 'resettoken-' + 'x'.repeat(30);
    d.prepare('INSERT INTO password_resets (token_hash, realm, subject_id, expires_at, used) VALUES (?,?,?,?,0)').run(sha256(raw), 'app', u.id, Date.now() + 3600e3);
    await page.goto(srv.base + '/app/#/reset/' + raw); await page.waitForSelector('#p'); await page.fill('#p', 'Brand-New-Pass-77'); await page.click('.btn.block');
    await page.waitForSelector('#go'); assert.match(await page.textContent('h1'), /Password updated/); assert.match(await page.textContent('.lead'), new RegExp(NOTE.replace(/[.]/g, '\\.')));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.click('#go'); await page.waitForSelector('#fg');
  } finally { d.close(); await br.close(); srv.stop(); }
});
