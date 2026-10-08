// SHARED / menu — the account menu opened from the person's name in the top bar (both consoles). Styling is all in the .menu* classes.
// Use:   const m = UI.menu.mount(el, { name, head, items, pick })   el = an empty element in the top bar.
//   items = [{ id, label, sep?: true } | { heading: 'Text' }], head = html shown at the top of the menu, pick(id) runs when an item is chosen.
//   An item may carry a badge (a count shown as a red chip); the menu button shows the badge option too (for example new replies waiting).
//   m.update({ head, items, badge }) swaps the content (the menu stays closed or reopens with the new rows); m.close() closes it.
// Phones (640px and narrower): the menu rises from the bottom like the other sheets, with a scrim. Larger screens: a popover under the top bar.
(() => {
  const { esc } = UI;
  const CHEVRON = '<svg class="icon menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  let seq = 0;
  const rows = (items) => items.map(it => it.heading ? `<div class="menu-label" role="presentation">${esc(it.heading)}</div>`
    : `<button type="button" class="menu-item${it.sep ? ' sep' : ''}" role="menuitem" tabindex="-1" data-id="${esc(it.id)}">${esc(it.label)}${it.badge ? `<span class="chip red">${esc(it.badge)}</span>` : ''}</button>`).join('');
  const badgeHtml = (n) => n ? `<span class="chip red" aria-label="${esc(n)} new">${esc(n)}</span>` : '';

  const mount = (el, { name, head = '', items = [], badge = 0, pick }) => {
    const id = `menu${++seq}`; let state = { head, items, badge };
    el.innerHTML = `<button type="button" class="menu-btn" id="${id}-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}"><span class="menu-name">${esc(name)}</span><span data-badge>${badgeHtml(badge)}</span>${CHEVRON}</button>`;
    const btn = el.querySelector('.menu-btn'); let layer = null;
    const list = () => layer ? [...layer.querySelectorAll('.menu-item')] : [];
    const close = (refocus) => {
      if (!layer) return;
      layer.remove(); layer = null; btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onOutside, true); document.removeEventListener('keydown', onKey, true);
      if (refocus) btn.focus();
    };
    const onOutside = (e) => { if (layer && !layer.querySelector('.menu-pop').contains(e.target) && !btn.contains(e.target)) close(false); };
    const onKey = (e) => {
      if (!layer) return;
      const items = list(), i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === 'Tab') close(false);
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, i - 1)]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); items.at(-1)?.focus(); }
    };
    const draw = () => `<div class="menu-scrim" data-menu-scrim></div><div class="menu-pop" id="${id}"><div class="menu-body">${state.head ? `<div class="menu-head">${state.head}</div>` : ''}<div class="menu-list" role="menu" aria-labelledby="${id}-btn">${rows(state.items)}</div></div></div>`;
    const open = () => {
      layer = document.createElement('div'); layer.className = 'menu-layer'; layer.innerHTML = draw(); document.body.append(layer);
      btn.setAttribute('aria-expanded', 'true');
      layer.addEventListener('click', (e) => { const b = e.target.closest('.menu-item'); if (b) { close(true); pick?.(b.dataset.id); } });
      document.addEventListener('mousedown', onOutside, true); document.addEventListener('keydown', onKey, true);
      list()[0]?.focus();
    };
    btn.addEventListener('click', () => layer ? close(false) : open());
    btn.addEventListener('keydown', (e) => { if (!layer && ['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); } });
    return { close, update: (next) => { const was = JSON.stringify(state); state = { head: next.head ?? state.head, items: next.items ?? state.items, badge: next.badge ?? state.badge }; btn.querySelector('[data-badge]').innerHTML = badgeHtml(state.badge); if (layer && JSON.stringify(state) !== was) { close(false); open(); } }, button: btn };
  };
  UI.menu = { mount };
})();
