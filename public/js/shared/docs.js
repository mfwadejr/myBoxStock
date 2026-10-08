// SHARED / docs — the Documentation viewer used by both consoles. `api` is the realm's client, `base` the path (/docs), `home` the app's own start page.
(() => {
  const { esc, swap, toast } = UI;
  // A page may end with a section titled "Printable ...": it gets a Print button, and only that section is printed (see .doc-print in components.css).
  const printable = (doc) => {
    const h = [...doc.querySelectorAll('h2')].find(x => /^Printable /.test(x.textContent)); if (!h) return;
    const wrap = document.createElement('div'); wrap.className = 'doc-print'; h.before(wrap);
    for (let n = h; n && !n.classList?.contains('doc-pager');) { const next = n.nextElementSibling; wrap.append(n); n = next; }
    wrap.insertAdjacentHTML('afterbegin', '<div class="no-print mb-md"><button type="button" class="btn secondary">Print the checklist</button></div>');
    wrap.querySelector('button').addEventListener('click', () => { const root = document.documentElement; root.classList.add('printing-doc'); window.addEventListener('afterprint', () => root.classList.remove('printing-doc'), { once: true }); window.print(); });
  };
  UI.docs = async (main, api, head, base = '/docs') => {
    const slug = (location.hash.replace(/^#\//, '').split('?')[0].split('/')[1] || ''), { pages } = await api('GET', base);
    const hit = (r) => `<a class="doc-hit" href="#/docs/${esc(r.slug)}"><b>${esc(r.title)}${r.section ? ` · ${esc(r.section)}` : ''}</b><span class="muted text-sm">${esc(r.snippet || r.summary)}</span></a>`;
    const box = `<div class="card"><input type="search" id="dq" placeholder="Search the documentation: a menu name, a setting, or a question" aria-label="Search the documentation"><div id="dres" class="mt-sm"></div></div>`;
    // One layout only: the contents on the left, and on the right the search box and the open topic. The landing page opens the first topic.
    const open = slug || pages[0]?.slug; let p; try { p = await api('GET', `${base}/${encodeURIComponent(open)}`); } catch { if (slug) { location.hash = '#/docs'; return; } throw new Error('The documentation could not be loaded.'); }
    const body = `<div class="doc-layout"><nav class="doc-toc" aria-label="Documentation contents">${pages.map(x => `<a href="#/docs/${esc(x.slug)}" class="${x.slug === open ? 'active' : ''}"${x.slug === open ? ' aria-current="page"' : ''}>${esc(x.title)}</a>`).join('')}</nav>
      <div class="doc-main">${box}<div class="card doc"><h1>${esc(p.title)}</h1><p class="lead">${esc(p.summary)}</p>${p.html}
      <div class="doc-pager">${p.prev ? `<a class="btn secondary" href="#/docs/${esc(p.prev.slug)}">‹ ${esc(p.prev.title)}</a>` : '<span></span>'}${p.next ? `<a class="btn secondary" href="#/docs/${esc(p.next.slug)}">${esc(p.next.title)} ›</a>` : ''}</div></div></div></div>`;
    swap(main, `${head('Documentation', 'How to do things, and why you would want to. Search, or pick a topic from the contents.')}${body}`);
    printable(main.querySelector('.doc'));
    const q = main.querySelector('#dq'), res = main.querySelector('#dres'); let t, seq = 0;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => {
      const mine = ++seq, v = q.value.trim(); if (v.length < 2) { res.innerHTML = ''; return; }
      try { const { results } = await api('GET', `${base}/search?q=${encodeURIComponent(v)}`); if (mine === seq) res.innerHTML = results.length ? results.map(hit).join('') : '<div class="empty">Nothing found. Try fewer or different words.</div>'; } catch (e) { toast(e.message, true); }
    }, 250); });
    main.scrollTo?.(0, 0); window.scrollTo(0, 0);
  };
})();
