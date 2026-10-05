// SERVICES / docs — the built-in Documentation. Pages are plain Markdown files in content/docs/<realm>/ (realm = reseller | host).
// Each file starts with a small header (title, summary, keywords, order, covers) and is loaded, indexed and searched here.
// The text is written by people and shipped with the app; nothing here reads any account's data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'content', 'docs');
export const REALMS = ['reseller', 'host'];
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const list = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);

// Inline: **bold**, `code`, [text](#/route). Links may only point inside the app (#/...), never elsewhere.
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\((#\/[a-z0-9/_-]+)\)/gi, '<a href="$2">$1</a>');

// Block: ## / ### headings, paragraphs, "- " lists, "1. " lists, "> " notes. Returns html plus the plain text and section list for search.
export function render(md) {
  const out = [], sections = [{ heading: '', text: [] }]; let para = [], items = null, kind = '', note = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); sections.at(-1).text.push(para.join(' ')); para = []; }
    if (items) { out.push(`<${kind}>${items.map(i => `<li>${inline(i)}</li>`).join('')}</${kind}>`); sections.at(-1).text.push(items.join(' ')); items = null; }
    if (note.length) { out.push(`<div class="doc-note">${inline(note.join(' '))}</div>`); sections.at(-1).text.push(note.join(' ')); note = []; }
  };
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd(); let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) { flush(); const lvl = m[1].length; out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); if (lvl === 2) sections.push({ heading: m[2], text: [] }); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { if (para.length || items) flush(); note.push(m[1]); continue; }
    if ((m = line.match(/^[-*]\s+(.+)$/))) { if (para.length || kind === 'ol' || note.length) flush(); kind = 'ul'; (items ||= []).push(m[1]); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.+)$/))) { if (para.length || kind === 'ul' || note.length) flush(); kind = 'ol'; (items ||= []).push(m[1]); continue; }
    if (items || note.length) flush();
    para.push(line.trim());
  }
  flush();
  return { html: out.join('\n'), sections: sections.map(s => ({ heading: s.heading, text: s.text.join(' ').replace(/[`*]|\[([^\]]+)\]\([^)]*\)/g, '$1') })) };
}

function parse(file, realm) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r/g, ''), m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing the header block`);
  const meta = Object.fromEntries(m[1].split('\n').map(l => { const i = l.indexOf(':'); return i < 0 ? null : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }).filter(Boolean));
  for (const k of ['title', 'summary', 'keywords', 'order']) if (!meta[k]) throw new Error(`${file}: header needs "${k}"`);
  const { html, sections } = render(m[2]);
  return { realm, slug: path.basename(file, '.md').replace(/^\d+-/, ''), title: meta.title, summary: meta.summary, keywords: list(meta.keywords), covers: list(meta.covers), order: Number(meta.order), html, sections, body: m[2] };
}

const cache = new Map();
export function load(realm) {
  if (!REALMS.includes(realm)) throw new Error('Unknown documentation set');
  if (cache.has(realm)) return cache.get(realm);
  const dir = path.join(ROOT, realm), pages = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => parse(path.join(dir, f), realm)) : [];
  pages.sort((a, b) => a.order - b.order); cache.set(realm, pages); return pages;
}
export const meta = (p) => ({ slug: p.slug, title: p.title, summary: p.summary, order: p.order });
export const toc = (realm) => load(realm).map(meta);
export function page(realm, slug) {
  const pages = load(realm), i = pages.findIndex(p => p.slug === slug); if (i < 0) return null;
  return { ...meta(pages[i]), html: pages[i].html, keywords: pages[i].keywords, prev: i ? meta(pages[i - 1]) : null, next: i < pages.length - 1 ? meta(pages[i + 1]) : null };
}

// Search: every word must appear somewhere in the page (title, keywords, covers, summary or text); title and keywords count most.
export function search(realm, query) {
  const terms = String(query || '').toLowerCase().split(/[^a-z0-9']+/).filter(t => t.length > 1).slice(0, 8); if (!terms.length) return [];
  const has = (hay, t) => hay.toLowerCase().includes(t);
  const scored = load(realm).map(p => {
    let score = 0, all = true, best = null, bestN = 0;
    for (const t of terms) {
      const title = has(p.title, t), kw = p.keywords.some(k => has(k, t)), cv = p.covers.some(k => has(k, t)), sm = has(p.summary, t);
      let body = 0; for (const s of p.sections) { const n = (s.text.toLowerCase().split(t).length - 1) + (has(s.heading, t) ? 3 : 0); body += n; if (n > bestN) { bestN = n; best = s; } }
      if (!(title || kw || cv || sm || body)) all = false;
      score += (title ? 12 : 0) + (kw ? 8 : 0) + (cv ? 8 : 0) + (sm ? 4 : 0) + Math.min(body, 6);
    }
    return { p, score, all, best };
  }).filter(x => x.score > 0);
  const hits = scored.some(x => x.all) ? scored.filter(x => x.all) : scored;
  return hits.sort((a, b) => b.score - a.score).slice(0, 12).map(({ p, best }) => {
    const text = best?.text || p.summary, i = Math.max(0, text.toLowerCase().indexOf(terms[0])), from = Math.max(0, i - 50);
    return { ...meta(p), section: best?.heading || '', snippet: (from ? '…' : '') + text.slice(from, from + 170) + (text.length > from + 170 ? '…' : '') };
  });
}
export const reset = () => cache.clear();
