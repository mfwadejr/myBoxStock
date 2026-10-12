// SHARED / a11y — gives screen readers what the markup leaves out, in one place, so every screen gets it:
//  • dropdowns (UI.select) and form controls without a visible label get a name (from the label beside them, the row title, or the table row and column);
//  • empty table headers get a hidden word, scrollable code areas can be reached with the keyboard;
//  • heading levels never skip (a card title under the page title reads as level 2, not 3).
// It only sets attributes and hidden text: nothing here changes how a page looks.
(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  let seq = 0; const idOf = (el) => el.id || (el.id = 'a11y-' + (++seq));
  const hasName = (el) => el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || [...(el.labels || [])].some(l => txt(l));

  // The name a control should have, taken from the text around it.
  function nameFor(el) {
    for (const box of [el.closest('.field'), el.closest('.setting')]) {
      const lab = box?.querySelector('label:not(.switch), .setting-title, .setting-name'); if (lab && !lab.contains(el) && txt(lab)) return { by: lab };
    }
    const td = el.closest('td'); if (td) {
      const tr = td.closest('tr'), col = td.cellIndex, th = td.closest('table')?.tHead?.rows[0]?.cells[col], first = tr?.cells[0];
      const parts = [first && first !== td ? txt(first) : '', txt(th)].filter(Boolean); if (parts.length) return { text: parts.join(', ') };
    }
    return null;
  }

  function controls(root) {
    root.querySelectorAll('.select-btn:not([data-named])').forEach(b => {
      b.dataset.named = '1'; if (hasName(b)) return;
      const n = nameFor(b); if (n?.by) { b.setAttribute('aria-labelledby', idOf(n.by)); return; } if (n?.text) { b.setAttribute('aria-label', n.text); return; }
      const v = b.querySelector('.select-label'); if (v) { b.setAttribute('aria-labelledby', idOf(v)); b.dataset.nameFallback = '1'; }   // last resort: the current choice is the name
    });
    root.querySelectorAll('input:not([type=hidden]):not([data-named]), textarea:not([data-named])').forEach(i => {
      i.dataset.named = '1'; if (hasName(i)) return;
      const n = nameFor(i); if (n?.by) i.setAttribute('aria-labelledby', idOf(n.by)); else if (n?.text) i.setAttribute('aria-label', n.text);
      else if (i.placeholder) i.setAttribute('aria-label', i.placeholder);
    });
    root.querySelectorAll('th:empty').forEach(th => { th.innerHTML = '<span class="sr-only">Actions</span>'; });
    root.querySelectorAll('.codeblock:not([tabindex]), pre:not([tabindex])').forEach(c => c.setAttribute('tabindex', '0'));
  }

  // Effective heading levels: each heading is at most one level deeper than the one before it, inside the page and inside each open sheet.
  function headings(scope) {
    let prev = null;
    scope.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      if (h.closest('.sheet') && h.closest('.sheet') !== scope) return;
      const lvl = Number(h.tagName[1]), eff = prev == null ? lvl : Math.min(lvl, prev + 1);
      if (eff !== lvl) { if (h.getAttribute('aria-level') !== String(eff)) { h.setAttribute('role', 'heading'); h.setAttribute('aria-level', String(eff)); } }
      else if (h.hasAttribute('aria-level') && h.dataset.a11yLevel) { h.removeAttribute('aria-level'); h.removeAttribute('role'); }
      if (eff !== lvl) h.dataset.a11yLevel = '1';
      prev = eff;
    });
  }

  let queued = false;
  const run = () => { queued = false; controls(document.body); document.querySelectorAll('.main, .sheet').forEach(headings); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } }).observe(document.body, { childList: true, subtree: true });
  UI.a11y = { run };
  run();
})();
