// SHARED / tabbar — the phone and tablet menu: a bar of the main pages at the bottom and a "More" sheet for the rest.
// `items` = [[key, label], ...], `icons` = { key: svg }, `primary` = the keys shown in the bar. Styling is all in responsive.css.
(() => {
  const { esc } = UI;
  const MORE = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';
  // A red count on a menu row. Rows are the side menu, the More sheet and the More button itself (which adds up the pages that live under it).
  let counts = {}, noun = 'new';
  const chip = (n) => n > 0 ? `<span class="chip red nav-count" role="img" aria-label="${esc(n)} ${esc(noun)}">${esc(n)}</span>` : '';
  const paint = (a, n) => { a.querySelector('.nav-count')?.remove(); if (n > 0) a.insertAdjacentHTML('beforeend', chip(n)); };
  UI.tabbar = {
    html: (items, primary, icons) => (counts = {}, `<nav class="tabbar" aria-label="Main menu">${items.filter(([k]) => primary.includes(k)).map(([k, l]) => `<a href="#/${k}" data-k="${k}">${icons[k] || ''}<span>${esc(l)}</span></a>`).join('')}<button type="button" data-more aria-haspopup="dialog">${MORE}<span>More</span></button></nav>`),
    // Opens the sheet with the remaining pages. `foot` = extra html under the list (who is signed in, Sign out); `mount(el, close)` wires it.
    bind: (root, items, primary, icons, { head = '', foot = '', mount } = {}) => root.querySelector('[data-more]')?.addEventListener('click', () => {
      const active = (location.hash.replace(/^#\//, '') || '').split('/')[0];
      UI.sheet(`<h2>Menu</h2>${head}<div class="sheet-menu">${items.filter(([k]) => !primary.includes(k)).map(([k, l]) => `<a href="#/${k}" data-k="${k}" class="${k === active ? 'active' : ''}"${k === active ? ' aria-current="page"' : ''}>${icons[k] || ''}<span>${esc(l)}</span>${chip(counts[k])}</a>`).join('')}</div>${foot}`,
        { onMount: (el, close) => { el.querySelectorAll('.sheet-menu a').forEach(a => a.addEventListener('click', () => close(null))); mount?.(el, close); } });
    }),
    // Shows red counts: setBadges(root, primary, { support: 3 }, 'new replies'). Zero hides the count. The More button shows the total of the pages under it.
    setBadges: (root, primary, map, what = 'new') => {
      // A count that went up is said out loud once (politely, without moving focus): "Support: 3 new replies".
      for (const [k, n] of Object.entries(map)) if (n > (counts[k] || 0)) { const a = document.querySelector(`.side a[data-k="${k}"] span:not(.chip), .tabbar a[data-k="${k}"] span:not(.chip)`); UI.announce?.(`${a ? a.textContent.trim() : k}: ${n} ${what}`); }
      counts = { ...map }; noun = what;
      document.querySelectorAll('.side a[data-k], .sheet-menu a[data-k]').forEach(a => paint(a, counts[a.dataset.k] || 0));
      const more = root.querySelector('[data-more]'); if (more) paint(more, Object.entries(counts).reduce((t, [k, n]) => t + (primary.includes(k) ? 0 : n), 0));
    },
    // Marks the current page in both the bar and the side menu (More is lit when the page is not in the bar).
    mark: (root, key, primary) => { root.querySelectorAll('.side a, .tabbar a').forEach(a => { a.classList.toggle('active', a.dataset.k === key); if (a.dataset.k === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); root.querySelector('[data-more]')?.classList.toggle('active', !primary.includes(key)); },
  };
  // Tables turn into cards on phones; each cell is labelled with its column heading so the card still reads clearly.
  const label = () => document.querySelectorAll('table').forEach(t => {
    const heads = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim()); if (!heads.length) return;
    t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && !td.hasAttribute('data-label')) td.setAttribute('data-label', i === 0 ? '' : (heads[i] || '')); }));
  });
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; label(); }); } }).observe(document.body, { childList: true, subtree: true });
})();
