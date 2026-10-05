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
  // Helper administrators cannot use the console until two-factor is on. The server enforces it; this is the screen that walks them through it.
  function mfaSetupScreen() {
    authShell(`<h1>Set up two-factor</h1><p class="lead">Every administrator needs an authenticator app on their account before using the Host Console. It takes a minute.</p>
      <button class="btn block" id="go">Set up two-factor</button><p class="hint center mt-md"><a href="#" id="back">Sign out</a></p>`);
    root.querySelector('#back').addEventListener('click', async (e) => { e.preventDefault(); await Host.api('POST', '/logout'); loginScreen(); });
    root.querySelector('#go').addEventListener('click', () => busy(root.querySelector('#go'), async () => { try { if (await UI.totpSetup(Host.api)) await boot(); } catch (er) { toast(er.message, true); } }));
  }
  function changePwScreen(forced) {
    authShell(`<h1>Choose a new password</h1><p class="lead">${forced ? 'For security, replace the temporary password before continuing.' : ''}</p>
      <form id="f"><div class="field"><label>Current password</label><input type="password" id="a" autocomplete="current-password" required></div>
      <div class="field"><label>New password</label><input type="password" id="b" autocomplete="new-password" required><div class="hint">At least 10 characters with letters and numbers.</div></div><button class="btn block" id="go">Update password</button></form>`);
    root.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); busy(root.querySelector('#go'), async () => { try { await Host.api('POST', '/change-password', { current: root.querySelector('#a').value, next: root.querySelector('#b').value }); toast('Password updated'); await boot(); } catch (er) { toast(er.message, true); } }); });
  }

  // The account menu: name, role, linked reseller accounts (for administrators who also run one, linked from inside that account) and Sign out. The links are refreshed on every page change so removed accounts drop out.
  const signOut = async () => { await Host.api('POST', '/logout'); Host.me = null; clearInterval(Host.timer); loginScreen(); };
  const menuItems = (accounts) => [...(accounts.length ? [{ heading: 'Reseller accounts' }, ...accounts.map(a => ({ id: `u:${a.login}`, label: a.businessName }))] : []), { id: 'out', label: 'Sign out', sep: accounts.length > 0 }];
  Host.refreshMenu = () => Host.api('GET', '/links').then(({ accounts }) => Host.menu?.update({ items: menuItems(accounts) })).catch(() => {});

  const PRIMARY = ['overview', 'alerts', 'accounts', 'logs']; // the phone tab bar; everything else is under More
  function shell() {
    root.innerHTML = `<header class="topbar"><div class="brand"><a class="brand-link" href="#/overview" aria-label="Home"><img class="brand-mark" src="/assets/logo-512.png" alt="myBoxStock" width="512" height="512"></a>myBoxStock <span class="brand-sub">Host</span></div><div class="grow"></div><span id="acct"></span></header>
      <div class="shell"><nav class="side">${Host.nav.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${Host.icons[k]}<span>${l}</span></a>`).join('')}</nav><main class="main" id="main"></main></div>${UI.tabbar.html(Host.nav, PRIMARY, Host.icons)}`;
    UI.tabbar.bind(root, Host.nav, PRIMARY, Host.icons);
    Host.menu = UI.menu.mount(root.querySelector('#acct'), { name: Host.me.username, head: `<b>${esc(Host.me.username)}</b><span>Host administrator</span>`, items: menuItems([]),
      pick: (id) => { if (id === 'out') signOut(); else if (id.startsWith('u:')) window.open(`/app/#/u/${encodeURIComponent(id.slice(2))}`, '_blank', 'noopener'); } });
    window.removeEventListener('hashchange', Host.route); window.addEventListener('hashchange', Host.route); Host.route();
  }
  // A banner at the top of every page while something needs attention (set-aside alerts do not count).
  Host.alertBanner = async () => {
    const main = root.querySelector('#main'); if (!main) return;
    let n = 0; try { n = (await Host.api('GET', '/alerts/count')).open; } catch {}
    main.querySelector('#alertbar')?.remove();
    if (n && Host.current !== 'alerts') main.insertAdjacentHTML('afterbegin', `<div class="banner red mb-lg" id="alertbar">${n} ${n === 1 ? 'problem needs' : 'problems need'} a look. <a href="#/alerts">Open Alerts</a></div>`);
  };
  Host.route = async () => {
    clearInterval(Host.timer);
    const key = (location.hash.replace(/^#\//, '').split('?')[0] || 'overview').split('/')[0], k = Host.views[key] ? key : 'overview';
    UI.tabbar.mark(root, k, PRIMARY);
    Host.refreshMenu();
    const main = root.querySelector('#main'); if (!main) return;
    Host.current = k;
    try { await Host.views[k](main); Host.alertBanner(); } catch (e) { if (e.status === 401) return boot(); if (e.data?.code === 'MFA_SETUP_REQUIRED') return mfaSetupScreen(); swap(main, `<div class="card"><p class="banner red">${esc(e.message)}</p></div>`); }
  };
  boot();
})();
