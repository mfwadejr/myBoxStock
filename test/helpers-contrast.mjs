// TEST / helpers-contrast — reads the colour tokens from public/css/tokens.css and works out WCAG 2.1 contrast ratios (translucent colours are laid over the surface they sit on).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

export const tokens = () => {
  const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const t = {}; for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) t[m[1]] = m[2].trim();
  for (const k of Object.keys(t)) { const r = t[k].match(/^var\((--[\w-]+)\)$/); if (r && t[r[1]]) t[k] = t[r[1]]; }   // a token that just points at another one
  return t;
};
export const parse = (v) => {
  v = v.trim(); let m;
  if ((m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i))) { let h = m[1]; if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1); }
  if ((m = v.match(/^rgba?\(([^)]+)\)$/i))) { const p = m[1].split(',').map(s => parseFloat(s)); return [p[0], p[1], p[2], p[3] ?? 1]; }
  throw new Error('cannot read colour ' + v);
};
const over = (top, under) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
// ratio of colour `fg` on colour `bg`; each is a list of token names, painted bottom to top (the first is the opaque base, for example ['--color-surface','--color-success-soft'])
export const ratio = (t, fg, bg) => {
  const paint = (names) => names.map(n => parse(t[n])).reduce((under, c) => under ? over(c, under) : c, null);
  const b = paint(bg), f = over(parse(t[fg[fg.length - 1]]), b);
  const [l1, l2] = [lum(f), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05);
};

const S = '--color-surface', B = '--color-bg', A = '--color-surface-alt';
// [foreground token, [background tokens bottom-to-top], minimum ratio, where it is used]
export const PAIRS = [
  ['--color-text', [S], 4.5, 'body text on cards'], ['--color-text', [B], 4.5, 'body text on the page'], ['--color-text', [A], 4.5, 'text on the nav'],
  ['--color-text-muted', [S], 4.5, 'secondary text on cards'], ['--color-text-muted', [B], 4.5, 'secondary text on the page'], ['--color-text-muted', [S, '--color-neutral-soft'], 4.5, 'neutral chip'],
  ['--color-text-faint', [S], 4.5, 'hints and notes on cards'], ['--color-text-faint', [B], 4.5, 'hints and notes on the page'], ['--color-text-faint', [A], 4.5, 'tab bar and brand on the nav'],
  ['--color-primary', [S], 4.5, 'links and active menu on cards'], ['--color-primary', [B], 4.5, 'links on the page'], ['--color-primary', [S, '--color-primary-soft'], 4.5, 'blue chip, active side menu'],
  ['--color-primary-text', [S, '--color-primary-soft'], 4.5, 'blue banner and selected filter'], ['--color-primary-on', ['--color-primary'], 4.5, 'primary button'], ['--color-primary-on', ['--color-primary-hover'], 4.5, 'primary button hover'],
  ['--color-success', [S], 4.5, 'green text'], ['--color-success', [S, '--color-success-soft'], 4.5, 'green chip'],
  ['--color-danger', [S], 4.5, 'red text'], ['--color-danger', [B], 4.5, 'red text on the page'], ['--color-danger', [S, '--color-danger-soft'], 4.5, 'red chip and banner'], ['--color-danger', [S, '--color-danger-soft-hover'], 4.5, 'danger button hover'],
  ['--color-warning', [S], 4.5, 'amber text'], ['--color-warning', [S, '--color-warning-soft'], 4.5, 'amber chip'], ['--color-warning-text', [S, '--color-warning-soft'], 4.5, 'warning banner'],
  ['--color-text', [S, '--color-neutral-soft'], 4.5, 'secondary button'], ['--color-text', [S, '--color-neutral-soft-hover'], 4.5, 'secondary button hover'], ['--color-text', [S, '--color-wash'], 4.5, 'menu row hover'],
  ['--color-toast-text', [B, '--color-toast'], 4.5, 'toast'], ['--color-toast-text', [B, '--color-toast-danger'], 4.5, 'error toast'],
  ['--color-scan-text', ['--color-scan-bg', '--color-scan-glass'], 4.5, 'camera panel'], ['--color-scan-text-soft', ['--color-scan-bg', '--color-scan-glass'], 4.5, 'camera panel hint'],
  ['--color-scan-text', ['--color-scan-bg', '--color-scan-btn'], 4.5, 'camera button'], ['--color-primary-on', ['--color-primary'], 4.5, 'camera primary button'],
  // not text: the colours that draw a focus ring and mark a control must stand out from the surface (WCAG 1.4.11, 3:1)
  ['--color-focus', [S], 3, 'focus ring on cards'], ['--color-focus', [B], 3, 'focus ring on the page'], ['--color-focus', [S, '--color-primary-soft'], 3, 'focus ring on a selected row'], ['--color-focus-on-dark', ['--color-scan-bg', '--color-scan-glass'], 3, 'focus ring in the camera layer'],
  ['--color-primary', [S], 3, 'selected tab, checked box, switch'], ['--color-success-switch', [S], 1.5, 'switch track on (the word On/Off also shows state)'],
];
