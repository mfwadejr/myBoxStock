// TEST / t50-label-extras — a real browser: the label border (rounded, on by default, can be turned off), the Label text size setting, the live label preview in Settings,
// the Print test label button (sample data, no sale recorded), and the Download PDF button (a real PDF with the exact page size).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: label border, text size, settings preview, test label and PDF download', { skip, timeout: 280000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const pick = async (id, value) => { await page.click('#' + id); await page.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${value}"]`).click(); };
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Label Co'); await page.fill('#em', 'l@example.com'); await page.fill('#un', 'lia'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'lia@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go');
    await page.waitForSelector('.side, .tabbar, nav', { timeout: 20000 }).catch(() => {});
    const defaults = await page.evaluate(() => AccountApp.labels.cfg());
    assert.equal(defaults.border, true, 'the border is on by default'); assert.equal(defaults.text, 'larger', 'Larger is the default text size');

    // Settings: live preview follows the choices before anything is saved
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#lprev .label');
    assert.match(await page.getAttribute('#lprev .label', 'class'), /has-border/); assert.match(await page.getAttribute('#lprev .label', 'class'), /txt-larger/);
    const radius = await page.evaluate(() => getComputedStyle(document.querySelector('#lprev .label'), '::before').borderTopLeftRadius); assert.notEqual(radius, '0px', 'the border has rounded corners');
    await page.uncheck('#lbord'); assert.doesNotMatch(await page.getAttribute('#lprev .label', 'class'), /has-border/);
    await page.check('#lbord'); await pick('ltx', 'largest'); assert.match(await page.getAttribute('#lprev .label', 'class'), /txt-largest/);
    await pick('lsz', 'dymo'); assert.match(await page.getAttribute('#lprev .label', 'class'), /size-dymo/);
    await pick('lst', 'plain'); assert.match(await page.getAttribute('#lprev .label', 'class'), /style-plain/);
    const sizeStd = async (t) => { await pick('ltx', t); return page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#lprev .label-to')).fontSize)); };
    const a = await sizeStd('standard'), b = await sizeStd('larger'), c = await sizeStd('largest'); assert.ok(a < b && b < c, `address text grows with the setting (${a}, ${b}, ${c})`);
    await page.fill('#ras', '77 Preview Lane'); assert.match(await page.textContent('#lprev .label-from'), /77 Preview Lane/);

    // Print test label: sample data, no sale recorded
    const before = await page.evaluate(() => AccountApp.store.entries ? AccountApp.store.entries('sale').length : -1);
    await page.click('#ltest'); await page.waitForSelector('.sheet .label');
    const txt = await page.textContent('.sheet .label'); assert.match(txt, /SAMPLE/); assert.match(txt, /77 Preview Lane/, 'the test label uses the unsaved settings');
    assert.equal(await page.locator('.sheet .label-mark').count(), 4, 'four corner marks on the test label');
    assert.equal(await page.locator('.sheet h2').textContent(), 'Test label');
    // Download PDF (sample): a real PDF, exact page size, rounded border, nothing sent
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#lpdf')]);
    assert.equal(dl.suggestedFilename(), 'test-label.pdf'); const pdf = fs.readFileSync(await dl.path()), s = pdf.toString('latin1');
    assert.ok(s.startsWith('%PDF-1.4'), 'a PDF file'); assert.match(s, /\/MediaBox \[0 0 294\.8 450\.71\]/, 'the DYMO page is 104 x 159 mm'); assert.match(s, /\(SAMPLE-0001\) Tj/); assert.match(s, /\(77 Preview Lane\)|Preview Lane/);
    assert.ok(!/barcode|qr/i.test(s));
    // the tracking number stays on one line (it is allowed its own row), at the DYMO size
    const oneLine = await page.evaluate(() => { const cells = [...document.querySelectorAll('.sheet .label-meta > div')], t = cells.find(c => /Tracking/.test(c.textContent)), b = t.querySelector('b'), lh = parseFloat(getComputedStyle(b).lineHeight) || parseFloat(getComputedStyle(b).fontSize) * 1.4; return b.getBoundingClientRect().height <= lh * 1.3; });
    assert.ok(oneLine, 'the tracking number is on a single line');
    const sameRow = await page.evaluate(() => { const top = (w) => [...document.querySelectorAll('.sheet .label-meta > .label-meta-row > div')].find(c => c.textContent.startsWith(w)).getBoundingClientRect().top; return Math.abs(top('Carrier') - top('Tracking')) < 2 && top('Order') < top('Carrier'); });
    assert.ok(sameRow, 'Carrier and Tracking are on the same row, below Order and Date');
    // Printer fit: left/right, up/down and printed size reach the label and the PDF; the test label carries six frames
    assert.equal(await page.locator('.sheet .label-frame').count(), 6, 'six nested frames on the test label');
    await pick('lfx', '2'); await pick('lfy', '4'); await pick('lfit', '94');
    assert.deepEqual(await page.evaluate(() => { const l = document.querySelector('.sheet .label'), cs = getComputedStyle(l); return [l.dataset.sx, l.dataset.sy, l.dataset.fit, cs.getPropertyValue('--label-shift-x').trim(), cs.getPropertyValue('--label-shift-y').trim(), cs.getPropertyValue('--label-fit-scale').trim()]; }), ['2', '4', '94', '2mm', '4mm', '0.94']);
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#lpdf')]); const s2 = fs.readFileSync(await dl2.path()).toString('latin1');
    assert.match(s2, /q 0\.94 0 0 0\.94 /, 'the PDF is drawn at 94%'); assert.match(s2, /\/MediaBox \[0 0 294\.8 450\.71\]/);
    await pick('lfx', '0'); await pick('lfy', '0'); await pick('lfit', '100');
    // border switch in the label window
    await page.uncheck('#lborder'); assert.doesNotMatch(await page.getAttribute('.sheet .label', 'class'), /has-border/);
    await page.check('#lborder'); await pick('ltext', 'standard'); assert.match(await page.getAttribute('.sheet .label', 'class'), /txt-standard/);
    await page.locator('.sheet [data-cancel]').last().click(); await page.waitForTimeout(350);
    const after = await page.evaluate(() => AccountApp.store.entries ? AccountApp.store.entries('sale').length : -1); assert.equal(after, before, 'no sale is recorded by a test label');

    // Save keeps the new settings
    await page.click('#save'); await page.waitForSelector('.toasts .toast');
    const saved = await page.evaluate(() => AccountApp.store.config().label); assert.equal(saved.size, 'dymo'); assert.equal(saved.text, 'largest'); assert.equal(saved.border, true);
    // before the tracking number is known: only the Carrier shows, alone at the left of its row; with neither, there is just the Order and Date row
    const variants = await page.evaluate(() => { const L = AccountApp.labels, mk = (dl) => { const s = L.sample(); Object.assign(s.data.delivery, dl); const el = document.createElement('div'); el.innerHTML = L.html(s, { size: 'dymo', look: 'plain', from: {}, border: true, text: 'larger' });
      return [...el.querySelectorAll('.label-meta-row')].map(r => [...r.children].map(c => c.firstChild.textContent)); };
      return { carrierOnly: mk({ tracking: '' }), neither: mk({ tracking: '', carrier: '' }), both: mk({}) }; });
    assert.deepEqual(variants.carrierOnly, [['Order', 'Date'], ['Carrier']]); assert.deepEqual(variants.neither, [['Order', 'Date']]); assert.deepEqual(variants.both, [['Order', 'Date'], ['Carrier', 'Tracking']]);
    // phone width: the Settings preview and the label window never scroll sideways
    await page.setViewportSize({ width: 390, height: 800 }); await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#lprev .label');
    const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 6).map(e => e.tagName + '.' + e.className + '#' + e.id));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on Settings at phone width: ' + wide.join(' | '));
    await page.click('#ltest'); await page.waitForSelector('.sheet .label'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll in the label window at phone width');
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
