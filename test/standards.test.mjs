// TEST / standards — enforces the project rules so nobody has to remember them:
//  1. every visual value lives in public/css/tokens.css; other CSS and all scripts use tokens/classes only
//  2. no inline styles, no style attributes, no colors in scripts or HTML
//  3. every class used in markup exists in the stylesheets; every var(--x) is defined
//  4. code is organized by function: every source file starts with a header comment; log areas used exist
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';
import { AREAS } from '../src/logging/areas.mjs';
import { EMAIL_THEME } from '../src/services/mail/theme.mjs';

const walk = (dir, filter, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!['node_modules', 'vendor', 'data'].includes(e.name)) walk(p, filter, out); } else if (filter(p)) out.push(p); } return out; };
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p);
const PUB = path.join(ROOT, 'public');
const cssFiles = walk(path.join(PUB, 'css'), p => p.endsWith('.css'));
const tokensFile = path.join(PUB, 'css', 'tokens.css');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// ---------- 1. CSS ----------
test('tokens.css is the only stylesheet with raw values', () => {
  const problems = [];
  for (const f of cssFiles.filter(f => f !== tokensFile)) {
    const css = stripComments(read(f)).replace(/@media[^{]*\{/g, '@media {'); // breakpoints can't use variables
    for (const m of css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/gi)) {
      const [, prop, value] = m;
      if (/#[0-9a-f]{3,8}\b/i.test(value.replace(/url\([^)]*\)/g, ''))) problems.push(`${rel(f)}: raw hex color in "${prop}: ${value.trim()}"`);
      if (/\b(rgba?|hsla?)\(/i.test(value)) problems.push(`${rel(f)}: raw color function in "${prop}: ${value.trim()}"`);
      if (/(?<![\w#.-])-?\d*\.?\d+(px|rem|em|ms|s|pt|vh|vw|deg)\b/.test(value)) problems.push(`${rel(f)}: raw length/time in "${prop}: ${value.trim()}"`);
      if (/(?<![\w#-])\d*\.\d+(?![\w])/.test(value)) problems.push(`${rel(f)}: raw decimal in "${prop}: ${value.trim()}"`);
      if (/^(font-weight|z-index|opacity|line-height|letter-spacing|font-size|border-radius|box-shadow|font-family)$/.test(prop) && !/var\(|inherit|^\s*(normal|none|0)\s*$/.test(value)) problems.push(`${rel(f)}: "${prop}" must use a token, got "${value.trim()}"`);
    }
    if (/\bstyle\s*=/.test(css)) problems.push(`${rel(f)}: stray style=`);
  }
  assert.deepEqual(problems, []);
});

test('every var(--token) used is defined in tokens.css (or is a sanctioned runtime property)', () => {
  const defined = new Set([...read(tokensFile).matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1])), runtime = new Set(['--pct']);
  const missing = [];
  for (const f of cssFiles) for (const m of stripComments(read(f)).matchAll(/var\((--[\w-]+)/g)) if (!defined.has(m[1]) && !runtime.has(m[1])) missing.push(`${rel(f)}: ${m[1]}`);
  assert.deepEqual([...new Set(missing)], []);
});

test('tokens.css defines the full standard set', () => {
  const t = read(tokensFile);
  for (const group of ['--color-', '--font-', '--text-', '--weight-', '--space-', '--radius-', '--border-', '--shadow-', '--dur-', '--z-', '--control-h', '--opacity-']) assert.ok(t.includes(group), `missing ${group}`);
});

// ---------- 2. scripts & markup ----------
test('scripts and HTML contain no inline styles or colors', () => {
  const files = [...walk(path.join(PUB, 'js'), p => p.endsWith('.js')), ...walk(PUB, p => p.endsWith('.html'))];
  const problems = [];
  for (const f of files) {
    const s = read(f);
    if (/\bstyle\s*=/.test(s)) problems.push(`${rel(f)}: inline style attribute`);
    if (/<style[\s>]/i.test(s)) problems.push(`${rel(f)}: <style> block`);
    for (const m of s.matchAll(/\.style\.(\w+)/g)) if (m[1] !== 'setProperty') problems.push(`${rel(f)}: .style.${m[1]} (use a class)`);
    for (const m of s.matchAll(/\.style\.setProperty\(\s*['"]([^'"]+)/g)) if (!m[1].startsWith('--')) problems.push(`${rel(f)}: setProperty of a real property`);
    if (/#[0-9a-fA-F]{6,8}\b/.test(s.replace(/<meta name="theme-color"[^>]*>/g, ''))) problems.push(`${rel(f)}: raw hex color`);
    if (/\b(rgba?|hsla?)\(/.test(s)) problems.push(`${rel(f)}: raw color function`);
    if (/\b(fill|stroke|stop-color|stop-opacity|stroke-width|font-size|font-family|opacity)\s*=\s*["'](?!none)/.test(s)) problems.push(`${rel(f)}: presentation attribute (use a class)`);
  }
  assert.deepEqual(problems, []);
});

test('every class used in markup is defined in the stylesheets', () => {
  const defined = new Set(); for (const f of cssFiles) for (const m of stripComments(read(f)).matchAll(/\.([a-zA-Z][\w-]*)/g)) defined.add(m[1]);
  const files = [...walk(path.join(PUB, 'js'), p => p.endsWith('.js')), ...walk(PUB, p => p.endsWith('.html'))], unknown = [];
  for (const f of files) {
    const s = read(f);
    for (const m of s.matchAll(/class="([^"]*)"/g)) {
      const attr = m[1];
      for (const expr of attr.matchAll(/\$\{([^}]*)\}/g)) for (const q of expr[1].matchAll(/[?:]\s*'([\w-]+)'/g)) if (!defined.has(q[1])) unknown.push(`${rel(f)}: .${q[1]}`);
      for (const c of attr.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (c && !defined.has(c)) unknown.push(`${rel(f)}: .${c}`);
    }
    for (const m of s.matchAll(/classList\.(?:add|toggle|remove)\(\s*['"]([\w-]+)['"]/g)) if (!defined.has(m[1])) unknown.push(`${rel(f)}: .${m[1]}`);
  }
  assert.deepEqual([...new Set(unknown)], []);
});

test('email styling stays in sync with the design tokens', () => {
  const t = read(tokensFile), get = (name) => (t.match(new RegExp(`${name}\\s*:\\s*([^;]+);`)) || [])[1]?.trim();
  for (const [name, value] of Object.entries(EMAIL_THEME)) assert.equal(value.toLowerCase(), String(get(name)).toLowerCase(), `${name} differs from tokens.css`);
  for (const html of walk(PUB, p => p.endsWith('index.html'))) assert.ok(read(html).includes(`content="${get('--color-bg')}"`) || !read(html).includes('theme-color'), `${rel(html)} theme-color should equal --color-bg`);
});

// ---------- 3. organization ----------
test('every source file starts with a header comment saying what it is for', () => {
  const bad = walk(path.join(ROOT, 'src'), p => p.endsWith('.mjs')).concat(path.join(ROOT, 'server.mjs'), walk(path.join(PUB, 'js'), p => p.endsWith('.js'))).filter(f => !read(f).trimStart().startsWith('//')).map(rel);
  assert.deepEqual(bad, []);
});

test('log areas used in code exist, and routes do not import across realms', () => {
  const unknown = [];
  for (const f of walk(path.join(ROOT, 'src'), p => p.endsWith('.mjs')).concat(path.join(ROOT, 'server.mjs'))) {
    const s = read(f);
    for (const m of s.matchAll(/areaLogger\(\s*'(\w+)'\s*\)/g)) if (!AREAS[m[1]]) unknown.push(`${rel(f)}: ${m[1]}`);
    for (const m of s.matchAll(/\blog\(\s*'(\w+)'\s*,\s*'(?:debug|info|warn|error)'/g)) if (!AREAS[m[1]]) unknown.push(`${rel(f)}: ${m[1]}`);
    for (const m of s.matchAll(/hostLog\([^)]*area:\s*'(\w+)'/g)) if (!AREAS[m[1]]) unknown.push(`${rel(f)}: ${m[1]}`);
  }
  assert.deepEqual(unknown, []);
  const crossed = walk(path.join(ROOT, 'src', 'routes', 'host'), p => p.endsWith('.mjs')).filter(f => /routes\/app|inventory_items/.test(read(f).split('\n').filter(l => !l.trim().startsWith('//')).join('\n').replace(/DELETE FROM inventory_items[^\n]*/g, ''))).map(rel);
  assert.deepEqual(crossed, [], 'host routes must not read tenant business tables');
});

test('every version has release notes in CHANGELOG.md', () => {
  const v = JSON.parse(read(path.join(ROOT, 'package.json'))).version;
  const log = read(path.join(ROOT, 'CHANGELOG.md'));
  assert.ok(new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}`, 'm').test(log), `CHANGELOG.md needs a "## [${v}] - YYYY-MM-DD" section (see docs/RELEASING.md)`);
});

test('every error code used in the server has one message in the catalog', async () => {
  const { MSG } = await import('../src/core/messages.mjs');
  const used = new Set();
  for (const f of walk(path.join(ROOT, 'src'), p => p.endsWith('.mjs'))) for (const m of read(f).matchAll(/fail\(res,\s*\d+,\s*'([A-Z_]+)'/g)) used.add(m[1]);
  for (const f of walk(path.join(ROOT, 'src'), p => p.endsWith('.mjs'))) for (const m of read(f).matchAll(/blockedReason = '([A-Z_]+)'|'(USER_DISABLED)'/g)) used.add(m[1] || m[2]);
  assert.deepEqual([...used].filter(c => !MSG[c]), [], 'codes without a message');
  assert.deepEqual(Object.values(MSG).filter(t => !/^[A-Z].*[.]$/.test(t)), [], 'messages are full sentences');
});

test('the themed dropdown is the only dropdown (no native <select> anywhere)', () => {
  const files = [...walk(path.join(ROOT, 'public'), p => /\.(js|html)$/.test(p))];
  assert.deepEqual(files.filter(f => /<select\b/i.test(read(f))).map(rel), []);
});
