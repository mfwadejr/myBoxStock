// SHARED / version — small deployed-version badge (reads /healthz). Styled by .version-badge only.
(() => {
  fetch('/healthz').then((r) => r.json()).then((h) => {
    if (!h.version) return;
    const b = document.createElement('div'); b.className = 'version-badge';
    b.textContent = `v${h.version}${h.build ? ` · ${h.build}` : ''}`;
    b.title = 'Deployed version';
    document.body.append(b);
  }).catch(() => {});
})();
