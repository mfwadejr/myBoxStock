// TEST / site — the marketing site build: every page has the shared footer with the four DRAFT legal pages, no inline styles, no stray values,
// no email address or phone number, no mention of complimentary plans, the standard liability wording, and every local link resolves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './helpers.mjs';

const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-site-')), 'myboxstock-site');
const r = spawnSync('node', ['tools/site/build.mjs', dir], { cwd: ROOT, encoding: 'utf8' });
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.html')) : [];
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const LEGAL = ['terms.html', 'privacy.html', 'data-responsibility.html', 'billing-terms.html'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('the site builds with every page and the four legal pages', () => {
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['index.html', 'features.html', 'security.html', 'pricing.html', 'support.html', ...LEGAL]) assert.ok(files.includes(f), f);
});

test('every page links the four legal pages in its footer; each legal page is labelled DRAFT', () => {
  for (const f of files) { const foot = read(f).match(/<footer[\s\S]*<\/footer>/)[0]; for (const l of LEGAL) assert.ok(foot.includes(`href="${l}"`), `${f} footer links ${l}`); }
  for (const f of LEGAL) { const h = read(f); assert.match(h, /DRAFT/); assert.match(h, /<title>[^<]*\(draft\)/); }
});

test('no inline styles, no email addresses or phone numbers, no complimentary-plan wording', () => {
  for (const f of files) {
    const h = read(f), text = h.replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(h, /\sstyle\s*=/i, `${f}: style attribute`); assert.doesNotMatch(h, /<style/i, `${f}: style element`);
    assert.doesNotMatch(h, /mailto:|tel:/i, `${f}: mailto or tel link`); assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.]+/, `${f}: email address`); assert.doesNotMatch(text, /\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/, `${f}: phone number`);
    assert.doesNotMatch(text, /\b(free plan|comped|complimentary)\b/i, `${f}: comped plan`);
    assert.doesNotMatch(text, /\b(the owner|the staff|we) (can|are able to) (see|read) (your|customer)/i, `${f}: liability wording`);
  }
});

test('the standard liability wording is used on the security and support pages', () => {
  for (const f of ['security.html', 'support.html']) assert.match(read(f), /myBoxStock, its owner and supporting staff cannot see your customer data \(inventory, customers, sales, receipts and prices\) and are not responsible or liable for it/);
});

test('site CSS: raw values live only in the token files; every var() is defined; no one-off styles', () => {
  const css = (f) => strip(fs.readFileSync(path.join(dir, 'ms', 'css', f), 'utf8'));
  const defined = new Set([...(css('tokens.css') + css('site-tokens.css')).matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));
  const problems = [];
  for (const f of ['site.css']) {
    const c = css(f).replace(/@media[^{]*\{/g, '@media {');
    for (const m of c.matchAll(/var\((--[a-z0-9-]+)/g)) if (!defined.has(m[1])) problems.push(`${f}: ${m[1]} is not defined`);
    for (const m of c.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/gi)) {
      const [, prop, value] = m;
      if (/#[0-9a-f]{3,8}\b/i.test(value) || /\b(rgba?|hsla?)\(/i.test(value)) problems.push(`${f}: raw colour in ${prop}`);
      if (/(?<![\w#.-])-?\d*\.?\d+(px|rem|em|ms|s|pt|vh|vw|deg)\b/.test(value)) problems.push(`${f}: raw length in "${prop}: ${value.trim()}"`);
    }
  }
  assert.deepEqual(problems, []);
});

test('every local link, stylesheet and script resolves (screenshots are made separately)', () => {
  const bad = [];
  for (const f of files) for (const m of read(f).matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
    const u = m[1]; if (/^(https?:|data:|mailto:)/.test(u) || u.startsWith('ms/shots/')) continue;
    if (!fs.existsSync(path.join(dir, u))) bad.push(`${f} -> ${u}`);
  }
  assert.deepEqual(bad, []);
});

// ---- W5: development status, sign-ups closed, Available today and Coming soon ----
import { AVAILABLE, COMING_SOON } from '../tools/site/src/content.mjs';
import { WORDS } from '../tools/site/src/settings.mjs';
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const textOf = (f) => read(f).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ');

test('closed notice, pricing line and a non-clickable sign-up state are on the pages; the setting is closed', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'tools/site/src/settings.mjs'), 'utf8'), /SITE_SIGNUPS \|\| 'closed'/);
  const home = textOf('index.html');
  assert.ok(home.includes('myBoxStock is in active development. Sign-ups are currently closed.'));
  assert.ok(home.includes('Sign-ups are currently closed'));
  assert.ok(textOf('pricing.html').includes('Plans and pricing are still being finalized.'));
  for (const f of ['faq.html', 'pricing.html']) assert.ok(textOf(f).includes(WORDS.faqQ) && textOf(f).includes('Not yet. myBoxStock is in active development'), `${f}: Can I sign up now?`);
  for (const f of files) { const foot = read(f).match(/<footer[\s\S]*<\/footer>/)[0]; assert.ok(foot.includes('Sign-ups are currently closed'), `${f}: footer notice`); }
  // the banner sits right under the main call to action
  assert.match(read('index.html'), /class="closedbtn"[^>]*>Sign-ups are currently closed<\/span>[\s\S]{0,400}class="banner devnote"/);
});

test('while closed there is no working sign-up link or button anywhere', () => {
  for (const f of files) { const h = read(f); assert.doesNotMatch(h, /data-app="signup"/, `${f}: sign-up link`); assert.doesNotMatch(h, /href="[^"]*#\/signup"/, `${f}: sign-up address`); assert.doesNotMatch(h, /<(a|button)[^>]*>\s*Sign up/i, `${f}: Sign up control`); }
  const html = read('index.html'); assert.doesNotMatch(html, /<a[^>]*>\s*Sign-ups are currently closed/); assert.doesNotMatch(html, /<form|<input/i, 'no notify-me or contact form');
});

test('one setting opens sign-ups: building with SITE_SIGNUPS=open gives sign-up links and no closed notices', () => {
  const d2 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-site-open-')), 'site');
  const r2 = spawnSync('node', ['tools/site/build.mjs', d2], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, SITE_SIGNUPS: 'open' } }); assert.equal(r2.status, 0, r2.stderr);
  const h = fs.readFileSync(path.join(d2, 'index.html'), 'utf8'); assert.match(h, /data-app="signup"/); assert.doesNotMatch(h, /Sign-ups are currently closed|active development/);
});

test('Available today lists only features the app ships, and Coming soon items carry no dates or promises', () => {
  assert.ok(AVAILABLE.length >= 12);
  for (const a of AVAILABLE) {
    assert.ok(a.ships?.length, `${a.id}: names the app code that ships it`);
    for (const [file, word] of a.ships) { assert.ok(fs.existsSync(path.join(ROOT, file)), `${a.id}: ${file} exists`); assert.ok(fs.readFileSync(path.join(ROOT, file), 'utf8').includes(word), `${a.id}: ${file} contains "${word}"`); }
    assert.ok(textOf('features.html').includes(a.h), `${a.id} is on the Features page`); assert.ok(read('features.html').includes(`id="${a.id}"`));
  }
  const need = ['Bulk scan', 'Running low', 'Quick sale', 'label', 'refund', 'saved address', 'profit', 'Administrator', 'View', 'Standard', 'Activity', 'backup', 'Get set up', 'support ticket', 'encrypted in your'];
  const all = textOf('features.html').toLowerCase(); for (const n of need) assert.ok(all.includes(n.toLowerCase()), `Features page covers ${n}`);
  const DATE = /\b(20\d\d|Q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|soon|next (week|month|year)|by (the )?end|this (year|quarter|summer|fall|winter|spring)|\d{1,2}\/\d{1,2})\b/i;
  for (const c of COMING_SOON) { assert.ok(c.title && c.text, 'item has a title and a sentence'); assert.doesNotMatch(c.title + ' ' + c.text, DATE, `Coming soon item has a date: ${c.title}`); }
  const home = read('index.html'), feat = read('features.html');
  if (!COMING_SOON.length) { for (const h of [home, feat]) { assert.doesNotMatch(h, /Coming soon|Planned and not yet available/); } } else for (const h of [home, feat]) assert.ok(h.includes(WORDS.comingLead));
  assert.doesNotMatch(read('features.html').match(/<main>[\s\S]*<\/main>/)[0], /\b20\d\d\b|\bQ[1-4]\b/, 'no dates on the Features page');
});

test('no banned phrases: no notify-me or waitlist, no trial or price or plan-limit claims, no Free plan, no email or phone', () => {
  const banned = /notify me|notified|waitlist|wait list|subscribe|newsletter|14 days|fourteen days|free trial|free for|no card|per month|\/month|per year|\bfree plan\b|comped|complimentary|users included|devices included|unlimited|\$\s?\d|€|£|call us|email us|contact us at/i;
  for (const f of files.filter(f => !LEGAL.includes(f))) { const t = textOf(f); const m = t.match(banned); assert.equal(m, null, `${f}: "${m?.[0]}"`); }
});

test('images: every screenshot a page uses is in the build, the PNGs are small, with alt text and sizes', () => {
  let n = 0;
  for (const f of files) for (const m of read(f).matchAll(/<img[^>]*src="(ms\/shots\/[^"]+)"[^>]*>/g)) {
    n++; const file = path.join(dir, m[1]); assert.ok(fs.existsSync(file), `${f}: ${m[1]} is missing`); assert.ok(fs.statSync(file).size < 250 * 1024, `${m[1]} is over 250 KB`);
    assert.match(m[0], /alt="[^"]{8,}"/); assert.match(m[0], /width="\d+" height="\d+"/); assert.match(m[0], /loading="lazy"/);
  }
  assert.ok(n >= 10, 'the pages show screenshots');
});

test('mobile viewport, version and date in the footer, and the Coming soon list is a one-edit data list', () => {
  for (const f of files) { assert.match(read(f), /<meta name="viewport" content="width=device-width, initial-scale=1">/); const foot = read(f).match(/<footer[\s\S]*<\/footer>/)[0]; assert.ok(foot.includes(`Version ${pkg.version}, built `) && /built \d{4}-\d\d-\d\d/.test(foot), `${f}: footer version and date`); }
  const css = fs.readFileSync(path.join(ROOT, 'tools/site/src/site.css'), 'utf8'); assert.match(css, /@media \(max-width: 820px\)/); assert.match(css, /\.closedbtn/);
  assert.match(fs.readFileSync(path.join(ROOT, 'tools/site/src/content.mjs'), 'utf8'), /export const COMING_SOON = \[/);
});
