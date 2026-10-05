// SHARED / docs — the Documentation viewer used by both consoles. `api` is the realm's client, `base` the path (/docs), `home` the app's own start page.
(() => {
  const { esc, swap, toast } = UI;
  UI.docs = async (main, api, head, base = '/docs') => {
    const slug = (location.hash.replace(/^#\//, '').split('?')[0].split('/')[1] || ''), { pages } = await api('GET', base);
    const hit = (r) => `<a class="doc-hit" href="#/docs/${esc(r.slug)}"><b>${esc(r.title)}${r.section ? ` · ${esc(r.section)}` : ''}</b><span class="muted text-sm">${esc(r.snippet || r.summary)}</span></a>`;
    const box = `<div class="card"><input type="search" id="dq" placeholder="Search the documentation: a menu name, a setting, or a question" aria-label="Search the documentation"><div id="dres" class="mt-sm"></div></div>`;
    let body;
    if (!slug) body = `${box}<div class="grid g2 mt-lg">${pages.map(p => `<a class="card doc-hit" href="#/docs/${esc(p.slug)}"><b>${esc(p.title)}</b><span class="muted">${esc(p.summary)}</span></a>`).join('')}</div>`;
    else {
      let p; try { p = await api('GET', `${base}/${encodeURIComponent(slug)}`); } catch { location.hash = '#/docs'; return; }
      body = `${box}<div class="doc-layout mt-lg"><nav class="doc-toc" aria-label="Documentation contents">${pages.map(x => `<a href="#/docs/${esc(x.slug)}" class="${x.slug === slug ? 'active' : ''}">${esc(x.title)}</a>`).join('')}</nav>
        <div class="card doc"><h1>${esc(p.title)}</h1><p class="lead">${esc(p.summary)}</p>${p.html}
        <div class="doc-pager">${p.prev ? `<a class="btn secondary" href="#/docs/${esc(p.prev.slug)}">‹ ${esc(p.prev.title)}</a>` : '<span></span>'}${p.next ? `<a class="btn secondary" href="#/docs/${esc(p.next.slug)}">${esc(p.next.title)} ›</a>` : ''}</div></div></div>`;
    }
    swap(main, `${head('Documentation', 'How to do things, and why you would want to. Search, or pick a topic.')}${body}`);
    const q = main.querySelector('#dq'), res = main.querySelector('#dres'); let t, seq = 0;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => {
      const mine = ++seq, v = q.value.trim(); if (v.length < 2) { res.innerHTML = ''; return; }
      try { const { results } = await api('GET', `${base}/search?q=${encodeURIComponent(v)}`); if (mine === seq) res.innerHTML = results.length ? results.map(hit).join('') : '<div class="empty">Nothing found. Try fewer or different words.</div>'; } catch (e) { toast(e.message, true); }
    }, 250); });
    main.scrollTo?.(0, 0); window.scrollTo(0, 0);
  };
})();
