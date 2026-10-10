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

// SHARED / tabrow (continued) — state for screen readers. Views show the chosen segment or filter with the class "on" (that is what the CSS styles).
// This keeps the matching ARIA state in step on its own, so no view has to remember it: a button in a segmented control or a filter button gets
// aria-pressed (aria-selected inside a tab list) that follows the class. A button that sets its own aria-pressed or aria-selected is left alone.
(() => {
  const SEL = '.seg button, button.filter';
  let uid = 0;
  const sync = () => {
    document.querySelectorAll(SEL).forEach(b => {
      const own = b.hasAttribute('aria-pressed') || b.hasAttribute('aria-selected'), mine = b.hasAttribute('data-aria-mirror');
      if (own && !mine) return;                                   // the view manages its own state
      const on = b.classList.contains('on'), list = b.closest('[role=tablist]');
      if (list) { if (!b.hasAttribute('role')) b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(on)); }
      else b.setAttribute('aria-pressed', String(on));
      b.setAttribute('data-aria-mirror', '');
    });
    // A settings row is a title, a description and one control (usually a switch). The title names the control and the description describes it.
    document.querySelectorAll('.setting').forEach(row => {
      const ctl = row.querySelector('.switch input, :scope > .select > .select-btn, :scope > input'), title = row.querySelector('.setting-title'), desc = row.querySelector('.setting-desc');
      if (!ctl || !title || ctl.hasAttribute('aria-label') || (ctl.hasAttribute('aria-labelledby') && !ctl.hasAttribute('data-aria-mirror'))) return;
      if (!title.id) title.id = `st-${++uid}`; ctl.setAttribute('aria-labelledby', title.id);
      if (desc && !ctl.hasAttribute('aria-describedby')) { if (!desc.id) desc.id = `sd-${++uid}`; ctl.setAttribute('aria-describedby', desc.id); }
      ctl.setAttribute('data-aria-mirror', '');
    });
  };
  let queued = false;
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; all(); }); } };
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  // A table row (or a list choice) that does something when clicked can be reached with Tab and used with Enter or Space, like the button it acts as.
  document.addEventListener('keydown', (e) => {
    const tr = e.target; if (!(tr instanceof Element) || !tr.matches('tr.click, .pick-list li') || e.target !== document.activeElement) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tr.click(); }
  });
  const rows = () => document.querySelectorAll('tr.click:not([tabindex])').forEach(tr => tr.setAttribute('tabindex', '0'));
  const all = () => { sync(); rows(); };
  UI.syncStates = all; all();
})();
