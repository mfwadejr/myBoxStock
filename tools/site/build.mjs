// TOOLS / site / build — builds the static marketing site folder.
// Usage: node tools/site/build.mjs <output-folder> [screenshots-folder]
//   output-folder       where the site is written (it is emptied first); the zip's top folder is usually named myboxstock-site
//   screenshots-folder  PNG files made by tools/site/shots.mjs (copied to ms/shots/)
// Pages come from src/pages.mjs; the four Legal pages are made from content/legal/*.md; the app's own tokens.css, base.css and
// components.css are copied in so the site always looks like the app. No page contains a style attribute.
import fs from 'node:fs';
import path from 'node:path';
import { PAGES, APP_SIGNUP, APP_LOGIN } from './src/pages.mjs';

const HERE = import.meta.dirname, ROOT = path.resolve(HERE, '..', '..');
const out = path.resolve(process.argv[2] || 'myboxstock-site'), shotsDir = process.argv[3] ? path.resolve(process.argv[3]) : '';
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- legal pages: md file -> page ----
const LEGAL = [['terms-of-service', 'terms.html', 'Terms of Service'], ['privacy-policy', 'privacy.html', 'Privacy Policy'], ['data-responsibility-and-acceptable-use', 'data-responsibility.html', 'Data responsibility and acceptable use'], ['billing-trial-and-refund-terms', 'billing-terms.html', 'Billing, trial and refund terms']];
const LINKS = Object.fromEntries(LEGAL.map(([md, file]) => [md, file]));
function parseMd(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/); const meta = {}; let body = text;
  if (m) { for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); } body = m[2]; }
  return { meta, body };
}
const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, a, u) => `<a href="${u.replace(/^#\/legal\//, '')}">${a}</a>`);
function mdToHtml(body) {
  const lines = body.split('\n'), out = []; let list = null, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd(); let m;
    if (!l.trim()) { flush(); close(); continue; }
    if ((m = l.match(/^(#{2,3})\s+(.*)$/))) { flush(); close(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = l.match(/^>\s?(.*)$/))) { flush(); close(); out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`); continue; }
    if ((m = l.match(/^[-*]\s+(.*)$/))) { flush(); if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = l.match(/^\d+\.\s+(.*)$/))) { flush(); if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    para.push(l.trim());
  }
  flush(); close(); return out.join('\n');
}
const legalPages = LEGAL.map(([md, file, name]) => {
  const { meta, body } = parseMd(fs.readFileSync(path.join(ROOT, 'content', 'legal', md + '.md'), 'utf8'));
  return { file, nav: '', legal: true, title: `${meta.title || name} (draft): myBoxStock`, desc: `${meta.summary || name} This is a draft and not yet in force.`, body: `
<section class="pagehead"><div class="wrap"><h1>${esc(meta.title || name)}</h1><div class="legalmeta"><span class="chip amber">DRAFT</span><span class="chip">Version ${esc(meta.version || 'draft')}</span><span class="chip">Draft effective ${esc(meta.effective || '')}</span></div></div></section>
<section class="section legal"><div class="wrap"><p class="banner"><strong>DRAFT.</strong> This page is a draft for review by an attorney. It is not legal advice and is not yet in force.</p>
${mdToHtml(body)}
</div></section>` };
});

// ---- shared header and footer ----
const NAV = PAGES.filter(p => p.nav);
const navHtml = (cur, cls) => NAV.map(p => `<a href="${p.file}"${p.file === cur ? ' class="on"' : ''}>${p.nav}</a>`).join('');
const header = (cur) => `<header class="sitebar"><div class="wrap">
<a class="sitebrand" href="index.html"><img src="ms/assets/logo-512.png" alt="" width="512" height="512">myBoxStock</a>
<nav class="sitenav" aria-label="Main">${navHtml(cur)}</nav>
<div class="siteactions"><a class="login" data-app="login" href="${APP_LOGIN}">Log in</a><a class="btn small" data-app="signup" href="${APP_SIGNUP}">Sign up free</a></div>
</div><nav class="mobnav" aria-label="Main">${navHtml(cur)}</nav></header>`;
const footer = () => `<footer class="sitefoot"><div class="wrap"><div class="about"><strong>myBoxStock</strong><br>Inventory and sales for people who sell streaming boxes.<br>© <span id="yr">2026</span> myBoxStock</div>
<div class="cols"><nav aria-label="Site">${NAV.map(p => `<a href="${p.file}">${p.nav}</a>`).join('')}<a data-app="login" href="${APP_LOGIN}">Log in</a><a data-app="signup" href="${APP_SIGNUP}">Sign up</a></nav>
<nav aria-label="Legal (drafts)">${legalPages.map(p => `<a href="${p.file}">${esc(p.title.replace(' (draft): myBoxStock', ''))}</a>`).join('')}</nav></div></div></footer>`;
const page = (p) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.desc)}">
<link rel="icon" href="favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="ms/assets/favicon-32.png"><link rel="apple-touch-icon" href="ms/assets/apple-touch-icon.png">
<meta name="theme-color" content="#f5f5f7">
<link rel="stylesheet" href="ms/css/tokens.css"><link rel="stylesheet" href="ms/css/site-tokens.css"><link rel="stylesheet" href="ms/css/base.css"><link rel="stylesheet" href="ms/css/components.css"><link rel="stylesheet" href="ms/css/site.css">
</head><body>
${header(p.file)}
<main>${p.body}</main>
${footer()}
<script src="ms/js/site.js"></script>
</body></html>
`;

// ---- write ----
fs.rmSync(out, { recursive: true, force: true }); for (const d of ['ms/css', 'ms/js', 'ms/assets', 'ms/shots']) fs.mkdirSync(path.join(out, d), { recursive: true });
for (const f of ['tokens', 'base', 'components']) fs.copyFileSync(path.join(ROOT, 'public', 'css', f + '.css'), path.join(out, 'ms', 'css', f + '.css'));
for (const f of ['site-tokens.css', 'site.css']) fs.copyFileSync(path.join(HERE, 'src', f), path.join(out, 'ms', 'css', f));
fs.copyFileSync(path.join(HERE, 'src', 'site.js'), path.join(out, 'ms', 'js', 'site.js'));
for (const f of ['logo-512.png', 'apple-touch-icon.png', 'favicon-32.png']) fs.copyFileSync(path.join(ROOT, 'public', 'assets', f), path.join(out, 'ms', 'assets', f));
fs.copyFileSync(path.join(ROOT, 'public', 'favicon.ico'), path.join(out, 'favicon.ico'));
if (shotsDir) for (const f of fs.readdirSync(shotsDir).filter(f => f.endsWith('.png'))) fs.copyFileSync(path.join(shotsDir, f), path.join(out, 'ms', 'shots', f));
for (const p of [...PAGES, ...legalPages]) fs.writeFileSync(path.join(out, p.file), page(p));
fs.writeFileSync(path.join(out, 'README.txt'), `myBoxStock marketing site (static files, no server needed). Built for myBoxStock ${VERSION}.

Pages: ${[...PAGES, ...legalPages].map(p => p.file).join(', ')}.
Upload the whole folder to any web host.

Where Log in and Sign up point: edit APP_URL in ms/js/site.js (the same address is also written into each page, so the buttons work with scripts blocked).
Colours, sizes and fonts: ms/css/tokens.css is a copy of the app's tokens, and ms/css/site-tokens.css holds the few site-only sizes. No page uses inline styles.
The four Legal pages are DRAFTS made from the app's content/legal files. Rebuild with: node tools/site/build.mjs <folder> <screenshots folder>.
Screenshots in ms/shots are of the real reseller app with made-up sample data (node tools/site/shots.mjs <folder>).
`);
console.log(`built ${PAGES.length + legalPages.length} pages into ${out}`);
