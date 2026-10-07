// SHARED / tabrow — makes a row of page tabs (class "seg tabs") behave on a phone: the selected tab is scrolled into view and a soft
// fade (classes more-start / more-end, styled in components.css) shows which side has more. Call UI.tabRow(el) once, UI.tabRow.sync(el) after the selection changes.
(() => {
  const mark = (el) => {
    el.classList.toggle('more-start', el.scrollLeft > 1);
    el.classList.toggle('more-end', el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };
  const sync = (el) => {
    const on = el.querySelector('button.on');
    if (on) el.scrollLeft = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
    mark(el);
  };
  UI.tabRow = (el) => { if (!el || el.dataset.tabrow) return; el.dataset.tabrow = '1'; el.addEventListener('scroll', () => mark(el), { passive: true }); window.addEventListener('resize', () => mark(el)); sync(el); };
  UI.tabRow.sync = sync;
})();
