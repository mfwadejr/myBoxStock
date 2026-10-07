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
