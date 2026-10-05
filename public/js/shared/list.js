// SHARED / list — long-list helpers: UI.more (feeds: "Showing N of M" + Load more) and UI.pager (working lists: pages + page size).
(() => {
  const { esc } = UI;
  const SIZES = [25, 50, 100];

  // Feed footer. Renders into `el` (an empty block). `load` fetches/reveals the next chunk and then calls UI.more again.
  //   UI.more(el, { shown: 100, total: 340, noun: 'entries', more: true, load: async () => {...} })
  // `total` may be null when the server cannot count; then only "Showing N" is given and `more` decides if the button shows.
  UI.more = (el, { shown, total = null, noun = 'entries', more = total == null ? false : shown < total, load }) => {
    el.classList.add('more-row');
    el.hidden = !shown;
    el.innerHTML = `<span class="muted text-sm">Showing ${shown}${total == null ? '' : ` of ${total}`} ${esc(noun)}</span>${more ? '<button type="button" class="btn secondary small" data-more>Load more</button>' : ''}`;
    const b = el.querySelector('[data-more]');
    if (b) b.addEventListener('click', async () => { b.disabled = true; try { await load(); } finally { if (b.isConnected) b.disabled = false; } });
  };

  // Page controls for a working list. Renders into `el`; `change({ page, size })` is called with the new state (page counts from 1).
  // Hidden while everything fits on the first page of the smallest size. Returns the slice bounds for the current state.
  UI.pager = (el, { page, size, total, change }) => {
    const pages = Math.max(1, Math.ceil(total / size)), p = Math.min(Math.max(1, page), pages);
    const from = total ? (p - 1) * size + 1 : 0, to = Math.min(total, p * size);
    el.classList.add('pager');
    el.hidden = total <= SIZES[0];
    el.innerHTML = `<span class="muted text-sm">Showing ${from}–${to} of ${total}</span>
      <div class="row">${UI.select.html({ id: 'pgsize', options: SIZES.map(n => [n, `${n} per page`]), value: size })}
        <button type="button" class="btn secondary small" data-prev ${p <= 1 ? 'disabled' : ''}>Previous</button><button type="button" class="btn secondary small" data-next ${p >= pages ? 'disabled' : ''}>Next</button></div>`;
    el.querySelector('[data-prev]').addEventListener('click', () => change({ page: p - 1, size }));
    el.querySelector('[data-next]').addEventListener('click', () => change({ page: p + 1, size }));
    el.querySelector('#pgsize').addEventListener('change', (e) => change({ page: 1, size: Number(UI.select.value(e.target)) }));
    return { from: (p - 1) * size, to: p * size, page: p };
  };
  UI.pageSizes = SIZES;

  // A feed whose rows are already in the browser (Host lists): shows the first chunk in `body` (a tbody or div) and reveals the next on Load more.
  //   UI.chunked({ body, foot, items, row: (item) => html, noun: 'accounts' })
  UI.chunked = ({ body, foot, items, row, noun = 'entries', chunk = 100 }) => {
    let shown = 0;
    const next = () => { body.insertAdjacentHTML('beforeend', items.slice(shown, shown + chunk).map(row).join('')); shown = Math.min(items.length, shown + chunk); UI.more(foot, { shown, total: items.length, noun, load: next }); };
    next();
  };
})();
