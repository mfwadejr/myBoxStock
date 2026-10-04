// HOST / main — sign-in screens, page shell and router. Views live in views/*.js and register on Host.views.
(() => {
  const { esc, toast, busy, swap } = UI;
  const root = document.getElementById('root');
  Host.api = UI.client('/api/host');
  Host.me = null;
  Host.head = (t, s = '') => `<div class="page-head"><h1>${t}</h1>${s ? `<p>${s}</p>` : ''}</div>`;

  const authShell = (inner) => { root.innerHTML = `<div class="authwrap"><div class="authcard"><img class="logo" src="/assets/logo-512.png" alt="myBoxStock" width="512" height="512">${inner}</div></div>`; };

  async function boot() {
    try { const r = await Host.api('GET', '/me'); UI.setCsrf(r.csrf); Host.me = r.user; if (r.mfaPending) return mfaScreen(); if (r.mustChange) return changePwScreen(true); return shell(); }
    catch { loginScreen(); }
  }
  function loginScreen() {
    authShell(`<h1>Host Console</h1><p class="lead">Sign in to administer this server.</p>
      <form id="f"><div class="field"><label>Username</label><input type="text" id="u" autocomplete="username" autocapitalize="none" required></div>
      <div class="field"><label>Password</label><input type="password" id="p" autocomplete="current-password" required></div><button class="btn block" id="go">Sign in</button></form>`);
    root.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); busy(root.querySelector('#go'), async () => { try {
      const r = await Host.api('POST', '/login', { login: root.querySelector('#u').value, password: root.querySelector('#p').value }); UI.setCsrf(r.csrf); if (r.mfa) return mfaScreen(); await boot();
    } catch (er) { toast(er.message, true); } }); });
  }
  function mfaScreen() {
    authShell(`<h1>Two-factor code</h1><p class="lead">Enter the 6-digit code from your authenticator app, or a recovery code.</p>
      <form id="f"><div class="field"><input type="text" class="codeinput" id="c" autocomplete="one-time-code" autofocus></div><button class="btn block" id="go">Verify</button><p class="hint center mt-md"><a href="#" id="back">Use a different account</a></p></form>`);
    root.querySelector('#back').addEventListener('click', async (e) => { e.preventDefault(); await Host.api('POST', '/logout'); loginScreen(); });
    root.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); busy(root.querySelector('#go'), async () => { try { await Host.api('POST', '/login/mfa', { code: root.querySelector('#c').value }); await boot(); } catch (er) { toast(er.message, true); } }); });
  }
  function changePwScreen(forced) {
    authShell(`<h1>Choose a new password</h1><p class="lead">${forced ? 'For security, replace the temporary password before continuing.' : ''}</p>
      <form id="f"><div class="field"><label>Current password</label><input type="password" id="a" autocomplete="current-password" required></div>
      <div class="field"><label>New password</label><input type="password" id="b" autocomplete="new-password" required><div class="hint">At least 10 characters with letters and numbers.</div></div><button class="btn block" id="go">Update password</button></form>`);
    root.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); busy(root.querySelector('#go'), async () => { try { await Host.api('POST', '/change-password', { current: root.querySelector('#a').value, next: root.querySelector('#b').value }); toast('Password updated'); await boot(); } catch (er) { toast(er.message, true); } }); });
  }

  function shell() {
    root.innerHTML = `<header class="topbar"><div class="brand"><a class="brand-link" href="#/overview" aria-label="Home"><img class="brand-mark" src="/assets/logo-512.png" alt="myBoxStock" width="512" height="512"></a>myBoxStock <span class="brand-sub">Host</span></div><div class="grow"></div>
      <span class="muted text-sm">${esc(Host.me.username)}</span><button class="btn secondary small" id="out">Sign out</button></header>
      <div class="shell"><nav class="side">${Host.nav.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${Host.icons[k]}<span>${l}</span></a>`).join('')}</nav><main class="main" id="main"></main></div>`;
    root.querySelector('#out').addEventListener('click', async () => { await Host.api('POST', '/logout'); Host.me = null; clearInterval(Host.timer); loginScreen(); });
    window.removeEventListener('hashchange', Host.route); window.addEventListener('hashchange', Host.route); Host.route();
  }
  Host.route = async () => {
    clearInterval(Host.timer);
    const key = (location.hash.replace(/^#\//, '').split('?')[0] || 'overview').split('/')[0], k = Host.views[key] ? key : 'overview';
    root.querySelectorAll('.side a').forEach(a => a.classList.toggle('active', a.dataset.k === k));
    const main = root.querySelector('#main'); if (!main) return;
    try { await Host.views[k](main); } catch (e) { if (e.status === 401) return boot(); swap(main, `<div class="card"><p class="banner red">${esc(e.message)}</p></div>`); }
  };
  boot();
})();
