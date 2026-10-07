// ROUTES / legal pages — /legal and /legal/<slug>: the Terms, Privacy Policy and other legal pages as plain web pages, for the marketing site and the Host Console footer.
// One source: the same content/legal/*.md the app shows, through the same renderer. Public, no sign-in, styling only from /css.
import express from 'express';
import { toc, page } from '../services/docs/index.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = ['tokens', 'base', 'layout', 'components', 'utilities', 'responsive'];
// Links inside a legal page are written for the app (#/docs/...); on a plain page they open the app's documentation.
const fixLinks = (html) => html.replace(/href="#\//g, 'href="/app/#/');

export function legalPages() {
  const r = express.Router();
  const shell = (title, inner) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · myBoxStock</title><link rel="icon" href="/favicon.ico" sizes="any">
${CSS.map(c => `<link rel="stylesheet" href="/css/${c}.css">`).join('\n')}</head>
<body><header class="topbar"><div class="brand"><a class="brand-link" href="/app/" aria-label="myBoxStock"><img class="brand-mark" src="/assets/logo-512.png" alt="myBoxStock" width="512" height="512"></a><span class="brand-name">myBoxStock</span></div></header>
<main class="legal-page">${inner}</main></body></html>`;
  r.get('/', (req, res) => res.redirect(`/legal/${toc('legal')[0].slug}`));
  r.get('/:slug', (req, res) => {
    const p = page('legal', String(req.params.slug));
    if (!p) return res.status(404).type('html').send(shell('Not found', '<div class="card"><h1>Page not found</h1><p class="lead">That legal page does not exist.</p></div>'));
    const nav = toc('legal').map(x => `<a href="/legal/${esc(x.slug)}" class="${x.slug === p.slug ? 'active' : ''}"${x.slug === p.slug ? ' aria-current="page"' : ''}>${esc(x.title)}</a>`).join('');
    res.type('html').send(shell(p.title, `<div class="doc-layout"><nav class="doc-toc" aria-label="Legal pages">${nav}</nav><div class="doc-main"><div class="card doc"><h1>${esc(p.title)}</h1><p class="lead">${esc(p.summary)}</p><p class="muted">Version ${esc(p.version)} · Effective ${esc(p.effective)}</p>${fixLinks(p.html)}</div></div></div>`));
  });
  return r;
}
