// APP / views / home-low — the "Running low" card on Home: one row per model at or below its reorder level, most urgent first. Worked out in the browser.
(() => {
  const { esc } = UI, A = AccountApp, C = A.commerce, S = A.store;
  const SHOW = 5;                       // rows shown before "Show all"
  let all = false;                      // "Show all" is kept while the app is open
  const KEY = () => `mbs.lowcard.${A.me?.id || 'me'}`;
  const hidden = () => { try { return localStorage.getItem(KEY()) === 'hidden'; } catch { return false; } };   // a per-person preference kept in this browser
  const setHidden = (v) => { try { if (v) localStorage.setItem(KEY(), 'hidden'); else localStorage.removeItem(KEY()); } catch { /* private window: the choice is simply not remembered */ } };

  // Models at or below their reorder level (Inventory > Stock levels). Out of stock first, then the lowest share of the reorder level.
  const rows = () => {
    const items = S.all('item'), names = [...new Set(items.map(e => (e.data.model || '').trim()).filter(Boolean))];
    return names.map(name => {
      const mine = items.filter(e => e.data.model === name), n = mine.filter(e => C.isAvail(e.data)).length, r = S.all('model').find(m => m.data.name === name)?.data.reorder || 0, make = mine.find(e => e.data.make)?.data.make || '';
      return { name, make, n, r, label: [make, name].filter(Boolean).join(' ') };
    }).filter(m => m.r > 0 && m.n <= m.r).sort((a, b) => (a.n === 0) !== (b.n === 0) ? (a.n === 0 ? -1 : 1) : a.n / a.r - b.n / b.r || a.n - b.n || a.label.localeCompare(b.label));
  };
  const row = (m) => `<a class="low-row" href="#/inventory" data-model="${esc(m.name)}"><div class="low-name"><div class="strong">${esc(m.label)}</div><div class="hint">${m.n} left · reorder at ${m.r}</div></div><div class="meter low-bar" role="img" aria-label="${m.n} of ${m.r}"><i class="${m.n === 0 ? 'bad' : 'warn'}" data-pct="${Math.min(100, Math.round(m.n / m.r * 100))}"></i></div>${m.n === 0 ? '<span class="chip red">Out of stock</span>' : '<span class="chip amber">Low</span>'}</a>`;

  A.homeLow = {
    rows,
    html: () => {
      const list = rows(); if (!list.length) return '';
      if (hidden()) return '<p class="hint mb-lg">The Running low card is hidden. <button type="button" class="linkbtn" id="lowshow">Show it</button></p>';
      const shown = all ? list : list.slice(0, SHOW);
      return `<div class="card mb-lg" id="lowbox"><div class="row spread wrap"><h3>Running low</h3><button type="button" class="linkbtn" id="lowhide">Hide</button></div><div class="low-list mt-sm">${shown.map(row).join('')}</div>${list.length > SHOW ? `<button type="button" class="linkbtn" id="lowall" aria-expanded="${all}">${all ? 'Show fewer' : `Show all (${list.length})`}</button>` : ''}</div>`;
    },
    wire: (main) => {
      const redraw = () => { main.querySelector('#lowcard').innerHTML = A.homeLow.html(); UI.dynamic(main); A.homeLow.wire(main); };
      main.querySelector('#lowhide')?.addEventListener('click', () => { setHidden(true); redraw(); });
      main.querySelector('#lowshow')?.addEventListener('click', () => { setHidden(false); redraw(); });
      main.querySelector('#lowall')?.addEventListener('click', () => { all = !all; redraw(); });
      main.querySelectorAll('.low-row').forEach(a => a.addEventListener('click', () => A.inventoryFilter(a.dataset.model)));
    },
  };
})();
