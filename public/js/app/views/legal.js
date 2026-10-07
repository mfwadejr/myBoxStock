// APP / views / legal — the Terms and Privacy pages inside the app (signed in or not), and the "Updated terms" screen Administrators accept at sign-in.
(() => {
  const { esc, swap, toast, busy } = UI;
  const api = () => AccountApp.api;
  // The open page (#/legal/<slug>) with the list of legal pages beside it. out = shown before sign-in, so it offers a way back.
  AccountApp.views.legal = async (main, out = false) => {
    const slug = location.hash.replace(/^#\//, '').split('?')[0].split('/')[1] || '', { pages } = await api()('GET', '/legal'), open = pages.some(p => p.slug === slug) ? slug : pages[0]?.slug;
    const p = await api()('GET', `/legal/${encodeURIComponent(open)}`);
    swap(main, `<div class="page-head"><h1>Legal</h1><p>The terms that apply when you use myBoxStock.</p></div>
      <div class="doc-layout"><nav class="doc-toc" aria-label="Legal pages">${pages.map(x => `<a href="#/legal/${esc(x.slug)}" class="${x.slug === open ? 'active' : ''}"${x.slug === open ? ' aria-current="page"' : ''}>${esc(x.title)}</a>`).join('')}</nav>
      <div class="doc-main"><div class="card doc"><h1>${esc(p.title)}</h1><p class="lead">${esc(p.summary)}</p><p class="muted">Version ${esc(p.version)} · Effective ${esc(p.effective)}</p>${p.html}${out ? '<div class="doc-pager"><a class="btn secondary" href="#" id="lback">Back to sign in</a></div>' : ''}</div></div></div>`);
    window.scrollTo(0, 0);
  };
  // Before sign-in: the legal pages as their own screen. Leaving the #/legal address returns to the normal sign-in flow.
  AccountApp.legalScreen = () => {
    AccountApp.root.innerHTML = '<div class="legal-page"><div id="main"></div></div>';
    const main = AccountApp.root.querySelector('#main');
    const draw = async () => {
      if (!/^#\/legal(\/|$)/.test(location.hash)) { window.removeEventListener('hashchange', draw); return AccountApp.boot(); }
      try { await AccountApp.views.legal(main, true); } catch (e) { toast(e.message, true); }
    };
    window.addEventListener('hashchange', draw); draw();
  };
  // A legal link clicked on a sign-in screen opens the legal pages without signing in.
  window.addEventListener('hashchange', () => { if (!AccountApp.me && /^#\/legal(\/|$)/.test(location.hash) && !AccountApp.root?.querySelector('.legal-page')) AccountApp.legalScreen(); });
  // Shown after sign-in when the terms changed (and to existing accounts once): an Administrator must accept to continue.
  AccountApp.termsScreen = () => {
    const me = AccountApp.me, links = UI.legal.pages.slice(0, 2).map(([s, t]) => `<a href="${UI.legal.href(s)}" target="_blank" rel="noopener">${t}</a>`);
    AccountApp.authShell(`<h1>Updated terms</h1><p class="lead">Our ${links[0]} and ${links[1]} have been updated. As an Administrator, please read and accept them to keep using ${esc(me.businessName)}.</p>
      <form id="f" novalidate><div class="field"><label class="check tap"><input type="checkbox" id="tc" aria-required="true" aria-describedby="tc-err"><span>I agree to the ${links[0]} and ${links[1]}</span></label><div class="hint danger-text" id="tc-err" role="alert" hidden>Tick the box to accept and continue.</div></div>
      <button class="btn block">Accept and continue</button></form><p class="hint center mt-lg"><a href="#" id="so">Sign out instead</a></p>`);
    const root = AccountApp.root, box = root.querySelector('#tc'), err = root.querySelector('#tc-err');
    box.addEventListener('change', () => { err.hidden = box.checked; box.removeAttribute('aria-invalid'); });
    root.querySelector('#so').addEventListener('click', (e) => { e.preventDefault(); AccountApp.signOut(); });
    root.querySelector('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!box.checked) { err.hidden = false; box.setAttribute('aria-invalid', 'true'); box.focus(); return; }
      busy(root.querySelector('button.block'), async () => { try { await AccountApp.api('POST', '/terms/accept', { version: me.termsVersion }); await AccountApp.boot(); } catch (er) { toast(er.message, true); } });
    });
  };
})();
