#!/usr/bin/env node
// TOOLS / docs-shots / insert-host-shots — adds (or refreshes) the `![alt](shot:NAME "caption")` lines in content/docs/host from manifest-host.mjs.
// Run once the docs renderer supports images (agent S); safe to re-run. `before` is the "## " heading the image goes above, or "@2" for above the second heading.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), dir = path.join(root, 'content/docs/host');
const list = (await import('./manifest-host.mjs')).default;
for (const e of list) {
  const file = path.join(dir, e.doc); let s = fs.readFileSync(file, 'utf8');
  s = s.replace(new RegExp(`^!\\[[^\\n]*\\]\\(shot:${e.name} [^\\n]*\\)\\n\\n`, 'm'), '');
  const heads = [...s.matchAll(/^## .*$/gm)], h = e.before === '@2' ? heads[1] : heads.find(m => m[0].slice(3).startsWith(e.before));
  if (!h) { console.error('no heading', e.name, e.before); process.exitCode = 1; continue; }
  s = s.slice(0, h.index) + `![${e.alt}](shot:${e.name} "${e.caption.replace(/"/g, "'")}")\n\n` + s.slice(h.index);
  fs.writeFileSync(file, s);
}
