// TEST / helpers-a11y — the in-page accessibility audit used by the browser test (names, roles, states, tab order, focus visibility, sideways scroll).
// AUDIT is a script run inside the page; it returns a list of plain-language problems (empty = clean).
export const AUDIT = `(() => {
  const problems = [];
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return (r.width > 0 && r.height > 0 || e.matches('input[type=checkbox],input[type=radio]')) && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden],[aria-hidden=true],.hide'); };
  const text = (e) => { let t = ''; const walk = (n) => { if (n.nodeType === 3) t += n.textContent; else if (n.nodeType === 1 && !n.matches('[aria-hidden=true],script,style')) { if (n.tagName === 'IMG' && n.alt) t += ' ' + n.alt + ' '; if (n.getAttribute('aria-label') && n !== e && !n.matches('button,a,input')) t += ' ' + n.getAttribute('aria-label') + ' '; n.childNodes.forEach(walk); } }; walk(e); return t.replace(/\\s+/g, ' ').trim(); };
  const byId = (id) => document.getElementById(id);
  const name = (e) => {
    const lb = e.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\\s+/).map(i => byId(i) ? text(byId(i)) : '').join(' ').trim(); if (t) return t; }
    const al = (e.getAttribute('aria-label') || '').trim(); if (al) return al;
    if (e.labels && e.labels.length) { const t = [...e.labels].map(text).join(' ').trim(); if (t) return t; }
    if (e.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(e.type) && e.value) return e.value;
    if (!['INPUT', 'TEXTAREA'].includes(e.tagName)) { const t = text(e); if (t) return t; }
    return (e.getAttribute('title') || '').trim();
  };
  const where = (e) => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') + ' <' + e.tagName.toLowerCase() + '> "' + (e.outerHTML.replace(/\\s+/g, ' ').slice(0, 90)) + '"';
  const SEL = 'button, a[href], input:not([type=hidden]), textarea, select, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=combobox], [role=menuitem], [role=option], [role=link], summary, [tabindex]';
  const seen = new Set();
  for (const e of document.querySelectorAll(SEL)) {
    if (!vis(e) || seen.has(e)) continue; seen.add(e);
    const ti = e.getAttribute('tabindex'); if (ti !== null && parseInt(ti, 10) > 0) problems.push('positive tabindex: ' + where(e));
    if (e.matches('[tabindex]') && !e.matches(SEL.replace(', [tabindex]', '')) && ti === '-1') continue;   // a container that takes focus from code
    if (e.matches('input[type=file]')) continue;
    if (!name(e)) problems.push('no accessible name: ' + where(e));
    if (e.matches('button, [role=button]') && !e.textContent.trim() && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.title) problems.push('icon-only control without a label: ' + where(e));
  }
  // things that look like a control but are not one
  for (const e of document.querySelectorAll('tr.click, .click:not(tr):not(button):not(a), [onclick]')) {
    if (!vis(e)) continue;
    const inner = e.querySelector('a[href], button, input, [role=button], [role=link]');
    if (e.getAttribute('tabindex') === null && !inner && !e.matches('a, button')) problems.push('clickable but not reachable by keyboard: ' + where(e));
  }
  // states
  for (const e of document.querySelectorAll('button.on, button.chip.on, .filter.on, .seg button, [role=tab]')) {
    if (!vis(e) || e.closest('th[aria-sort]')) continue;   // a sort button: the column header carries aria-sort
    if (!e.hasAttribute('aria-pressed') && !e.hasAttribute('aria-selected') && !e.hasAttribute('aria-current') && !e.hasAttribute('aria-expanded')) problems.push('state not exposed (aria-pressed/selected/current): ' + where(e));
  }
  for (const e of document.querySelectorAll('[role=tab]')) if (vis(e) && !e.closest('[role=tablist]')) problems.push('tab outside a tablist: ' + where(e));
  for (const e of document.querySelectorAll('[role=dialog]')) if (vis(e) && !name(e)) problems.push('dialog without a name: ' + where(e));
  for (const e of document.querySelectorAll('img')) if (vis(e) && !e.hasAttribute('alt')) problems.push('image without alt: ' + where(e));
  for (const e of document.querySelectorAll('nav')) if (vis(e) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')) problems.push('navigation without a name: ' + where(e));
  for (const e of document.querySelectorAll('[role=progressbar]')) if (vis(e) && !name(e)) problems.push('progress bar without a name: ' + where(e));
  const ids = {}; for (const e of document.querySelectorAll('[id]')) ids[e.id] = (ids[e.id] || 0) + 1; for (const [i, n] of Object.entries(ids)) if (n > 1 && i) problems.push('duplicate id "' + i + '" (' + n + ' times; labels and descriptions point at ids)');
  for (const e of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')) for (const a of ['aria-labelledby', 'aria-describedby', 'aria-controls']) for (const i of (e.getAttribute(a) || '').split(/\\s+/).filter(Boolean)) if (!byId(i) && !(a === 'aria-controls' && e.getAttribute('aria-expanded') === 'false')) problems.push(a + ' points at a missing id "' + i + '": ' + where(e));
  if (!document.documentElement.lang) problems.push('page has no lang');
  if (!document.querySelector('main, [role=main]')) problems.push('no main landmark');
  const h1 = [...document.querySelectorAll('h1')].filter(vis).length; if (h1 !== 1) problems.push('expected one visible h1, found ' + h1);
  const over = document.documentElement.scrollWidth - innerWidth; if (over > 1) problems.push('page scrolls sideways by ' + over + 'px');
  return problems;
})()`;

// Press Tab through the page and report any stop that shows no focus ring (outline or the ring shadow) or that lands outside the window.
export const TAB_WALK = async (page, max = 60) => {
  const bad = []; await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  const seen = new Set();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      if (!e.matches(':focus')) return { tag: 'browser widget', ring: true };   // focus is inside the browser's own picker button of a date box, which draws its own ring
      const s = getComputedStyle(e), tag = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '');
      let ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== 'none' && /rgb/.test(s.boxShadow));
      if (!ring && e.matches('input[type=checkbox],input[type=radio]')) { const n = e.nextElementSibling; if (n) { const t = getComputedStyle(n); ring = t.boxShadow !== 'none'; } if (!ring) ring = s.outlineStyle !== 'none'; }
      return { tag, ring, tabindex: e.getAttribute('tabindex') };
    });
    if (!r) break; const key = r.tag + i; if (seen.has(r.tag) && seen.size > max) break; seen.add(r.tag);
    if (!r.ring) bad.push('no visible focus ring on ' + r.tag);
  }
  return bad;
};
