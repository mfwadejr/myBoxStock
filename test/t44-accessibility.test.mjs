// TEST / t44-accessibility — T44 accessibility sweep, kept honest so it cannot slip back:
//  1. static: every button, input, textarea, switch and checkbox in the shipped views has a name; no icon-only control without a label; no positive tabindex; the focus ring lives in one place
//  2. contrast: every colour token pair that carries text (or marks a control) meets WCAG 2.1 AA, computed from public/css/tokens.css
//  3. CSS rules: reduced motion, touch size, one focus ring, status never by colour alone (chips carry words)
//  4. a headless browser pass over the main screens at phone and laptop width: names, roles, focus rings, Escape on a sheet, focus returns, no sideways scroll
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startServer, fillLogin, Client } from './helpers.mjs';
import { tokens, ratio, PAIRS } from './helpers-contrast.mjs';
import { AUDIT, TAB_WALK } from './helpers-a11y.mjs';

const PUB = path.join(ROOT, 'public');
const walk = (dir, filter, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'vendor') walk(p, filter, out); } else if (filter(p)) out.push(p); } return out; };
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p);
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const SHIPPED = [...walk(path.join(PUB, 'js', 'app'), p => p.endsWith('.js')), ...walk(path.join(PUB, 'js', 'host'), p => p.endsWith('.js')), ...walk(path.join(PUB, 'js', 'shared'), p => p.endsWith('.js')), path.join(PUB, 'app', 'index.html'), path.join(PUB, 'host', 'index.html')];
const CSS = walk(path.join(PUB, 'css'), p => p.endsWith('.css'));

// ---------- 1. static checks on the shipped views ----------
test('every button, link, input and textarea in the shipped views has an accessible name', () => {
  const problems = [];
  for (const f of SHIPPED) {
    const s = read(f);
    for (const m of s.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const text = m[2].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\$\{[^}]*(icon|ICON|svg|SVG|I\.|CHEVRON|MORE)[^}]*\}/g, '').trim();
      if (!text && !/aria-label|aria-labelledby|\btitle=/.test(m[1])) problems.push(`${rel(f)}: icon-only button without a label: ${m[0].slice(0, 100).replace(/\n/g, ' ')}`);
    }
    for (const m of s.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      const text = m[2].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\$\{[^}]*(icon|svg)[^}]*\}/gi, '').trim();
      if (!text && !/aria-label/.test(m[1]) && !/<img[^>]+alt="[^"]+"/.test(m[2])) problems.push(`${rel(f)}: icon-only link without a label: ${m[0].slice(0, 100).replace(/\n/g, ' ')}`);
    }
    for (const m of s.matchAll(/<(input|textarea)\b([^>]*)>/g)) {
      const a = m[2]; if (/type="(hidden|file)"/.test(a) || /aria-label|aria-labelledby/.test(a)) continue;
      const id = (a.match(/\bid="([^"]+)"/) || [])[1], before = s.slice(Math.max(0, m.index - 1400), m.index);
      if (before.slice(-500).lastIndexOf('<label') > before.slice(-500).lastIndexOf('</label>')) continue;   // sits inside its <label>
      if (id && before.slice(-1400).includes(`for="${id}"`)) continue;                              // a <label for> just above points at it (ids repeat between screens, so it must be the nearby one)
      problems.push(`${rel(f)}: ${m[1]} without a name: ${m[0].slice(0, 100)}`);
    }
    for (const m of s.matchAll(/tabindex\s*=\s*["']?([1-9]\d*)/g)) problems.push(`${rel(f)}: positive tabindex ${m[1]}`);
    for (const m of s.matchAll(/\.tabIndex\s*=\s*([1-9]\d*)/g)) problems.push(`${rel(f)}: positive tabIndex ${m[1]}`);
    for (const m of s.matchAll(/<img\b([^>]*)>/g)) if (!/\balt=/.test(m[1])) problems.push(`${rel(f)}: image without alt: ${m[0].slice(0, 80)}`);
  }
  assert.deepEqual(problems, []);
});

test('a label that names a field points at it (for= matches an id that exists in the same view)', () => {
  const problems = [];
  for (const f of SHIPPED) {
    const s = read(f);
    for (const m of s.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
      const id = m[1]; if (id.includes('${')) continue;
      if (!s.includes(`id="${id}"`) && !s.includes(`id: '${id}'`) && !s.includes(`id="${id}`) && !new RegExp(`id: ?'${id}`).test(s) && !s.includes(`id='${id}'`)) problems.push(`${rel(f)}: label for="${id}" has no matching id`);
    }
  }
  assert.deepEqual(problems, []);
});

test('toggle-style controls expose their state: the shared state mirror covers segmented controls and filter buttons', () => {
  // views mark the chosen segment or filter with the class "on" (what the CSS styles); public/js/shared/tabrow.js turns that into aria-pressed / aria-selected, and the browser pass below checks it in the page
  const row = read(path.join(PUB, 'js', 'shared', 'tabrow.js'));
  for (const need of ["'.seg button, button.filter'", 'aria-pressed', 'aria-selected', 'MutationObserver', "role=tablist"]) assert.ok(row.includes(need), `tabrow.js: ${need}`);
  // a view must never set the state to something the class disagrees with
  const bad = [];
  for (const f of SHIPPED) for (const m of read(f).matchAll(/<button\b[^>]*class="[^"]*\bon\b[^"]*"[^>]*aria-pressed="false"/g)) bad.push(`${rel(f)}: ${m[0].slice(0, 100)}`);
  assert.deepEqual(bad, []);
});

// ---------- 2. contrast ----------
test('colour tokens: every text and control pair meets WCAG 2.1 AA (4.5:1 text, 3:1 focus ring and controls)', () => {
  const t = tokens(), fails = [];
  for (const [fg, bg, min, where] of PAIRS) {
    for (const n of [fg, ...bg]) assert.ok(t[n], `token ${n} is missing from tokens.css`);
    const r = ratio(t, [fg], bg); if (r < min) fails.push(`${r.toFixed(2)}:1 (needs ${min}) ${fg} on ${bg.join(' + ')} — ${where}`);
  }
  assert.deepEqual(fails, []);
});

test('the colours the CSS actually uses for text are covered by a checked pair', () => {
  // every "color: var(--color-x)" in the stylesheets must be one of the foregrounds in PAIRS (or a decorative/disabled use listed here), so a new text colour cannot skip the check
  const covered = new Set(PAIRS.map(p => p[0])), decorative = new Set(['--color-knob', '--color-toast', '--color-switch-off', '--color-scan-ok', '--color-scan-warn', '--color-scan-aim', '--color-label-ink', '--color-qr-dark', '--color-danger-soft', '--color-primary-soft']);
  const used = new Set();
  for (const f of CSS) for (const m of stripComments(read(f)).matchAll(/(?<![-\w])color\s*:\s*var\((--color-[\w-]+)\)/g)) used.add(m[1]);
  const missing = [...used].filter(c => !covered.has(c) && !decorative.has(c));
  assert.deepEqual(missing, [], 'text colours with no contrast check in test/helpers-contrast.mjs');
});

test('status is never shown by colour alone: red, amber and green chips are text, and count badges name what they count', () => {
  const comp = stripComments(read(path.join(PUB, 'css', 'components.css')));
  assert.match(comp, /\.chip\s*\{[^}]*display:\s*inline-flex/, 'a chip is a text label');
  const bad = [];
  for (const f of SHIPPED) {
    const s = read(f);
    for (const m of s.matchAll(/<span class="chip (?:red|green|amber|blue)[^"]*"[^>]*>\s*<\/span>/g)) bad.push(`${rel(f)}: empty coloured chip: ${m[0].slice(0, 90)}`);
    for (const m of s.matchAll(/class="chip red nav-count"[^>]*>/g)) if (!/aria-label/.test(m[0])) bad.push(`${rel(f)}: count badge without a name`);
  }
  assert.deepEqual(bad, []);
});

// ---------- 3. CSS rules ----------
test('focus: one ring token and one rule in base.css; nothing else removes the outline', () => {
  const t = read(path.join(PUB, 'css', 'tokens.css')), base = stripComments(read(path.join(PUB, 'css', 'base.css')));
  for (const k of ['--focus-ring', '--color-focus', '--focus-outline-w', '--focus-outline-offset']) assert.ok(t.includes(k + ':'), `tokens.css defines ${k}`);
  assert.match(base, /:focus-visible\s*\{\s*outline:\s*var\(--focus-outline-w\)\s+solid\s+var\(--color-focus\)/, 'base.css has the one outline for every focusable thing');
  assert.match(base, /\.focus-ring:focus-visible/, 'base.css has the .focus-ring class');
  assert.match(base, /\{\s*outline:\s*none;\s*box-shadow:\s*var\(--focus-ring\);\s*\}/, 'the ring-as-shadow group uses the token');
  const stray = [];
  for (const f of CSS.filter(f => !f.endsWith('base.css'))) for (const m of stripComments(read(f)).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const [, sel, body] = m;
    if (/outline\s*:\s*(none|0)\b/.test(body) && !/^\s*(\.sheet:focus|\.scanner:focus)\s*$/.test(sel)) stray.push(`${rel(f)}: ${sel.trim()} removes the outline (add the control to the group in base.css instead)`);
    if (/:focus(-visible)?\b/.test(sel) && /box-shadow\s*:/.test(body) && !/inset/.test(body)) stray.push(`${rel(f)}: ${sel.trim()} draws its own focus shadow`);
  }
  assert.deepEqual(stray, []);
  const css = CSS.map(f => stripComments(read(f))).join('\n');
  assert.doesNotMatch(css, /:focus[^{]*\{[^}]*outline:\s*0/);
});

test('reduced motion is respected and touch targets keep --tap-min', () => {
  const motion = stripComments(read(path.join(PUB, 'css', 'motion.css')));
  assert.match(motion, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation:\s*none\s*!important[^}]*transition:\s*none\s*!important/s);
  const comp = stripComments(read(path.join(PUB, 'css', 'components.css'))), resp = stripComments(read(path.join(PUB, 'css', 'responsive.css')));
  assert.match(read(path.join(PUB, 'css', 'tokens.css')), /--tap-min:\s*44px/);
  assert.match(comp + resp, /var\(--tap-min\)/);
  // scrolling that the browser animates (smooth scroll) must stop too
  assert.doesNotMatch(stripComments(CSS.map(read).join('\n')), /scroll-behavior:\s*smooth/);
});

test('live announcements: toasts and the shared announcer are polite live regions that never take focus', () => {
  const toast = read(path.join(PUB, 'js', 'shared', 'toast.js'));
  assert.match(toast, /aria-live/); assert.match(toast, /UI\.announce\s*=/); assert.match(toast, /role', 'alert'/);
  assert.doesNotMatch(toast, /\.focus\(/, 'a toast or announcement must not move focus');
  const tb = read(path.join(PUB, 'js', 'shared', 'tabbar.js')); assert.match(tb, /UI\.announce/, 'a rising count badge is announced');
  const sheet = read(path.join(PUB, 'js', 'shared', 'sheet.js'));
  for (const need of ['aria-modal', 'aria-labelledby', "'Escape'", "e.key === 'Tab'", 'opener.focus']) assert.ok(sheet.includes(need), `sheet.js: ${need}`);
  const menu = read(path.join(PUB, 'js', 'shared', 'menu.js')); for (const need of ['aria-haspopup', 'aria-expanded', "'Escape'", 'btn.focus()']) assert.ok(menu.includes(need), `menu.js: ${need}`);
  const sel = read(path.join(PUB, 'js', 'shared', 'select.js')); for (const need of ['role="combobox"', 'aria-expanded', 'aria-selected', "'Escape'"]) assert.ok(sel.includes(need), `select.js: ${need}`);
});

// ---------- 4. headless browser pass ----------
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';
const WIDTHS = [[375, 812, 'phone'], [1280, 800, 'laptop']];
const relax = async (srv) => { const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW }); await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 }); return c; };

// Look at the page as it is now and fail with a readable list.
async function inspect(page, label, { tabs = 40 } = {}) {   // the pages run with reduced motion switched on (motion.css stops every transition), so a ring is read at once and not part-way through a fade
  await page.waitForTimeout(250);
  const found = await page.evaluate(AUDIT), ring = await TAB_WALK(page, tabs);
  assert.deepEqual([...new Set(found)], [], `${label}: accessibility problems`);
  assert.deepEqual([...new Set(ring)], [], `${label}: focus is not visible`);
}
// A sheet opened from `opener`: focus moves inside, the dialog has a name, Tab stays inside, Escape closes, and focus goes back to the opener.
async function sheetCheck(page, label, openerSel) {
  await page.focus(openerSel); await page.keyboard.press('Enter');
  await page.waitForSelector('.scrim:not(.closing) .sheet', { timeout: 5000 });
  const r = await page.evaluate(() => { const d = [...document.querySelectorAll('.scrim:not(.closing) .sheet[role=dialog]')].pop(); return { inside: !!d && d.contains(document.activeElement), named: !!(d && (d.getAttribute('aria-label') || document.getElementById(d.getAttribute('aria-labelledby') || '')?.textContent.trim())), modal: d?.getAttribute('aria-modal') }; });
  assert.ok(r.inside, `${label}: focus moves into the sheet (focus is on ${await page.evaluate(() => document.activeElement.outerHTML.slice(0, 120))})`); assert.ok(r.named, `${label}: the sheet has a name`); assert.equal(r.modal, 'true');
  const found = await page.evaluate(AUDIT); assert.deepEqual([...new Set(found)], [], `${label}: problems inside the sheet`);
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('.sheet')), `${label}: Tab stays inside the sheet (stop ${i + 1})`); }
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.scrim:not(.closing)'), null, { timeout: 4000 });
  assert.ok(await page.evaluate((s) => { const o = document.querySelector(s); return !!o && document.activeElement === o; }, openerSel), `${label}: focus returns to the control that opened the sheet`);
}

for (const [w, h, size] of WIDTHS) {
  test(`browser: reseller screens are accessible at ${w}px (${size})`, { skip, timeout: 420000 }, async () => {
    const srv = await startServer(); await relax(srv);
    const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }), page = await ctx.newPage();
    page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(srv.base + '/app/'); await page.waitForSelector('#l'); await inspect(page, `${size} sign-in`);
      await page.click('[data-mode=signup]'); await page.waitForSelector('#bn'); await inspect(page, `${size} sign-up`);
      await page.fill('#bn', 'Access Co'); await page.fill('#em', 'a11y@example.com'); await page.fill('#un', 'ally'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
      await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(); await page.click('#go');
      await page.waitForSelector('#fg'); await page.click('#fg'); await page.waitForSelector('#f #l'); await inspect(page, `${size} forgot password`);
      await page.goto(srv.base + '/app/'); await page.waitForSelector('#l');
      await fillLogin(page, 'ally@' + id); await page.fill('#p', PW); await page.click('button.block');
      await page.waitForSelector('.recovery-key'); await inspect(page, `${size} recovery key`); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.main');
      await page.evaluate(async () => { const S = AccountApp.store;
        await S.commit({ puts: [{ type: 'customer', data: { name: 'Zed Buyer', phone: '555-0100', email: 'zed@example.com', notes: '', createdAt: Date.now() } }, ...[1, 2, 3].map(i => ({ type: 'item', data: { uid: 'Q-' + i, make: 'Roku', model: 'Ultra 4800', status: 'available', cost: 10000, price: 34000, addedAt: Date.now() } }))] });
        await S.commit({ puts: [{ type: 'sale', data: { no: 'S-TEST-0001', ts: Date.now(), customerName: 'Zed Buyer', items: [{ make: 'Roku', model: 'Ultra', uid: 'U-1', price: 5000 }], subtotal: 5000, total: 5000, cost: 2000, payment: 'cash' } }] }); });
      let sheets = 0;
      for (const key of ['home', 'inventory', 'sell', 'sales', 'customers', 'settings', 'security', 'backup', 'support']) {
        await page.goto(srv.base + '/app/#/' + key); await page.waitForSelector('.main h1'); await page.waitForTimeout(300);
        await inspect(page, `${size} app/${key}`);
        // the first action button of the page head opens a sheet on most screens: check the dialog behaviour there
        const head = page.locator('.page-head button.btn, .page-head a.btn').first();
        if (await head.count() && key !== 'support') { const sel = await head.evaluate(e => { e.setAttribute('data-a11y-opener', '1'); return '[data-a11y-opener]'; }); const before = await page.locator('.scrim').count(); await page.focus(sel); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
          if (await page.locator('.scrim:not(.closing)').count() > before) { sheets++; assert.ok(await page.evaluate(() => !!document.activeElement.closest('.sheet')), `${size} app/${key}: focus moves into the sheet`); const found = await page.evaluate(AUDIT); assert.deepEqual([...new Set(found)], [], `${size} app/${key}: problems inside the sheet`); await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.scrim:not(.closing)'), null, { timeout: 4000 }); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-a11y-opener')), '1', `${size} app/${key}: focus returns to the opener`); }
          await page.evaluate(() => document.querySelector('[data-a11y-opener]')?.removeAttribute('data-a11y-opener')); }
      }
      assert.ok(sheets >= 1, 'at least one screen opened a sheet from its page head');
      // a confirm dialog opened from code, on the top bar menu button, and the More sheet on small screens
      await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('.main h1');
      await page.evaluate(() => { document.querySelector('.menu-btn').setAttribute('data-a11y-opener', '1'); });
      await page.focus('.menu-btn'); await page.evaluate(() => { UI.confirmBox({ title: 'Remove it?', body: 'Check the focus.', confirmLabel: 'Remove', danger: true, typeToConfirm: 'REMOVE' }); });
      await page.waitForSelector('.sheet'); const named = await page.evaluate(() => document.getElementById(document.querySelector('.sheet').getAttribute('aria-labelledby')).textContent); assert.equal(named, 'Remove it?');
      assert.ok(await page.evaluate(() => document.activeElement.id === 'tc'), 'the typed-confirmation box has focus'); assert.deepEqual(await page.evaluate(AUDIT), []);
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.scrim:not(.closing)')); assert.ok(await page.evaluate(() => document.activeElement.classList.contains('menu-btn')), 'focus returns to the menu button');
      // account menu: opens with Enter, arrow keys move, Escape closes and returns
      await page.keyboard.press('Enter'); await page.waitForSelector('.menu-item'); assert.ok(await page.evaluate(() => document.activeElement.classList.contains('menu-item')), 'focus moves into the menu'); assert.equal(await page.getAttribute('.menu-btn', 'aria-expanded'), 'true');
      assert.deepEqual(await page.evaluate(AUDIT), [], `${size} account menu`); await page.keyboard.press('Escape'); await page.waitForSelector('.menu-item', { state: 'detached' }); assert.ok(await page.evaluate(() => document.activeElement.classList.contains('menu-btn')), 'Escape returns focus to the menu button'); assert.equal(await page.getAttribute('.menu-btn', 'aria-expanded'), 'false');
      if (w <= 820) { await sheetCheck(page, `${size} More`, '[data-more]'); }
      // live messages: a toast is a status (an error is an alert), the announcer speaks without moving focus, and a select inside a sheet closes first on Escape
      await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('.main h1'); await page.focus('.menu-btn');
      await page.evaluate(() => { UI.toast('Saved'); UI.toast('Could not save', true); UI.announce('Support: 2 new replies'); });
      assert.equal(await page.getAttribute('.toasts', 'aria-live'), 'polite'); assert.equal(await page.getAttribute('.toast.err', 'role'), 'alert');
      await page.waitForFunction(() => document.querySelector('[data-live=talk]')?.textContent === 'Support: 2 new replies'); assert.ok(await page.evaluate(() => document.activeElement.classList.contains('menu-btn')), 'announcing does not move focus');
      await page.evaluate(() => { UI.sheet(`<h2>Pick one</h2><div class="field"><label for="pk">Colour</label>${UI.select.html({ id: 'pk', options: [['a', 'Red'], ['b', 'Blue']] })}</div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button></div>`); });
      await page.waitForSelector('.sheet #pk'); await page.focus('#pk'); await page.keyboard.press('Enter'); await page.waitForSelector('.select.open');
      await page.keyboard.press('Escape'); await page.waitForTimeout(150); assert.equal(await page.locator('.select.open').count(), 0, 'Escape closes the dropdown'); assert.equal(await page.locator('.scrim:not(.closing)').count(), 1, 'the sheet is still open after the first Escape');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.scrim:not(.closing)'));
      // the menu count badge has a name and the rest of the screen reads it politely
      await page.evaluate(() => { const m = AccountApp.menu; m.update({ badge: 3, items: [{ id: 'support', label: 'Support', badge: 3 }, { id: 'out', label: 'Sign out', sep: true }] }); });
      assert.equal(await page.getAttribute('.menu-btn .chip', 'aria-label'), '3 new');
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); }
  });

  test(`browser: Host screens are accessible at ${w}px (${size})`, { skip, timeout: 420000 }, async () => {
    const srv = await startServer(); await relax(srv);
    const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(srv.base + '/host/'); await page.waitForSelector('input'); await inspect(page, `${size} Host sign-in`);
      const ins = await page.$$('input'); await ins[0].fill('admin'); await ins[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');
      for (const key of ['overview', 'accounts', 'backups', 'email', 'support', 'retention', 'demo']) {
        await page.goto(srv.base + '/host/#/' + key); await page.waitForSelector('.main h1'); await page.waitForTimeout(400);
        await inspect(page, `${size} host/${key}`);
      }
      await page.goto(srv.base + '/host/#/overview'); await page.waitForSelector('.menu-btn'); await page.focus('.menu-btn'); await page.keyboard.press('Enter'); await page.waitForSelector('.menu-item'); await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('menu-btn')), 'Escape returns focus to the menu button');
      if (w <= 820) await sheetCheck(page, `${size} Host More`, '[data-more]');
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); }
  });
}
