// APP / main — sign-in, sign-up, reset screens, page shell and router. Views live in views/*.js.
(() => {
  const { esc, toast, busy, swap } = UI;
  const root = document.getElementById('root');
  AccountApp.api = UI.client('/api/app');
  AccountApp.me = null;
  AccountApp.can = (p) => AccountApp.me.perms.includes('*') || AccountApp.me.perms.includes(p);
  let cfg = { siteName: 'myBoxStock', signupsEnabled: true, trialDays: 14 };

  const authShell = (inner) => { root.innerHTML = `<div class="authwrap"><div class="authcard"><div class="logo">▦</div>${inner}</div></div>`; };
  AccountApp.root = root; AccountApp.authShell = authShell; AccountApp.pw = null; // the password typed at sign-in, held only until the data is unlocked
  AccountApp.signOut = async () => { try { await AccountApp.api('POST', '/logout'); } catch {} AccountApp.me = null; AccountApp.pw = null; AccountApp.vault.clear(); loginScreen(); };
  const onSubmit = (sel, fn) => root.querySelector(sel).addEventListener('submit', (e) => { e.preventDefault(); busy(root.querySelector(sel + ' button.block'), async () => { try { await fn(); } catch (er) { toast(er.message, true); } }); });
  const val = (id) => root.querySelector(id).value;

  // Sign in | Create account switch shown at the top of both screens (only when sign-ups are open).
  const modeSwitch = (on) => cfg.signupsEnabled ? `<div class="seg wide mb-lg" role="tablist"><button type="button" data-mode="login" class="${on === 'login' ? 'on' : ''}">Sign in</button><button type="button" data-mode="signup" class="${on === 'signup' ? 'on' : ''}">Create account</button></div>` : '';
  const wireSwitch = () => root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => b.dataset.mode === 'signup' ? signupScreen() : loginScreen()));

  async function boot() {
    if (!globalThis.crypto?.subtle) { // browsers only offer encryption on https:// or localhost
      authShell(`<h1>Secure connection needed</h1><p class="lead">Your data is encrypted in your browser, and browsers only allow that on a secure (https) address. You opened this site over plain http (${esc(location.host)}).</p><p class="hint">Ask whoever runs this site to publish it with https, or open it from the computer that hosts it using localhost.</p>`);
      return;
    }
    try { cfg = await AccountApp.api('GET', '/public-config'); } catch {}
    const m = location.hash.match(/^#\/reset\/(.+)$/); if (m) return resetScreen(m[1]);
    try { const r = await AccountApp.api('GET', '/me'); UI.setCsrf(r.csrf); AccountApp.me = r.user; AccountApp.vault.state = r.vault; if (r.mfaPending) return mfaScreen(); if (r.mustChange) return changePwScreen(); if (!await AccountApp.vault.gate(r, AccountApp.pw)) return; AccountApp.pw = null; await AccountApp.store.load(); return shell(); }
    catch (e) { loginScreen(); if (e && e.status !== 401) toast(e.message || 'Sign-in could not finish. Please try again.', true); }
  }
  function loginScreen() {
    authShell(`${modeSwitch('login')}<h1>${esc(cfg.siteName)}</h1><p class="lead">Sign in to your account.</p>
      <form id="f"><div class="field"><label>Sign-in</label><input type="text" id="l" placeholder="username@BX-ABC123" autocapitalize="none" autocomplete="username" required><div class="hint">Your username followed by your account ID.</div></div>
      <div class="field"><label>Password</label><input type="password" id="p" autocomplete="current-password" required></div><button class="btn block">Sign in</button></form>
      <p class="hint center mt-lg"><a href="#" id="fg">Forgot password?</a>${cfg.signupsEnabled ? ' · <a href="#" id="su">Create an account</a>' : ''}</p>`);
    wireSwitch();
    root.querySelector('#fg').addEventListener('click', (e) => { e.preventDefault(); forgotScreen(); });
    root.querySelector('#su')?.addEventListener('click', (e) => { e.preventDefault(); signupScreen(); });
    onSubmit('#f', async () => { AccountApp.pw = val('#p'); let r; try { r = await AccountApp.api('POST', '/login', { login: val('#l'), password: AccountApp.pw }); } catch (e) { AccountApp.pw = null; throw e; } UI.setCsrf(r.csrf); if (r.mfa) return mfaScreen(); await boot(); });
  }
  function mfaScreen() {
    authShell(`<h1>Two-factor code</h1><p class="lead">Enter the 6-digit code from your authenticator app, or a recovery code.</p>
      <form id="f"><div class="field"><input type="text" class="codeinput" id="c" autocomplete="one-time-code" autofocus></div><button class="btn block">Verify</button></form>`);
    onSubmit('#f', async () => { await AccountApp.api('POST', '/login/mfa', { code: val('#c') }); await boot(); });
  }
  function changePwScreen() {
    authShell(`<h1>Choose a new password</h1><p class="lead">Replace your temporary password to continue.</p>
      <form id="f"><div class="field"><label>Current password</label><input type="password" id="a" autocomplete="current-password" required></div><div class="field"><label>New password</label><input type="password" id="b" autocomplete="new-password" required><div class="hint">At least 10 characters with letters and numbers.</div></div><button class="btn block">Update password</button></form>`);
    onSubmit('#f', async () => { const keys = await AccountApp.vault.keysForNewPassword(val('#a'), val('#b')); await AccountApp.api('POST', '/change-password', { current: val('#a'), next: val('#b'), keys }); AccountApp.pw = val('#b'); await boot(); });
  }
  function signupScreen() {
    authShell(`${modeSwitch('signup')}<h1>Create your account</h1><p class="lead">Track inventory and sales for your business. Free for ${esc(cfg.trialDays)} days — no card needed.</p>
      <form id="f"><div class="field"><label>Business name</label><input type="text" id="bn" required></div><div class="field"><label>Email</label><input type="email" id="em" autocomplete="email" required></div>
      <div class="field"><label>Username</label><input type="text" id="un" autocapitalize="none" autocomplete="username" required></div><div class="field"><label>Password</label><input type="password" id="pw" autocomplete="new-password" required><div class="hint">At least 10 characters with letters and numbers.</div></div>
      <button class="btn block">Create account</button></form><p class="hint center mt-lg"><a href="#" id="bk">Back to sign in</a></p>`);
    wireSwitch();
    root.querySelector('#bk').addEventListener('click', (e) => { e.preventDefault(); loginScreen(); });
    onSubmit('#f', async () => {
      const r = await AccountApp.api('POST', '/signup', { businessName: val('#bn'), email: val('#em'), username: val('#un'), password: val('#pw') });
      authShell(`<h1>You’re all set</h1><p class="lead">Keep your account ID — it’s part of every sign-in.</p><div class="codeblock large">${esc(r.login)}</div><p class="hint center my-lg">Account ID <b>${esc(r.accountCode)}</b>. We’ve also emailed it to you.</p><button class="btn block" id="go">Continue to sign in</button>`);
      root.querySelector('#go').addEventListener('click', loginScreen);
    });
  }
  function forgotScreen() {
    authShell(`<h1>Reset password</h1><p class="lead">Enter your sign-in and we’ll email a reset link.</p><form id="f"><div class="field"><input type="text" id="l" placeholder="username@BX-ABC123" autocapitalize="none" required></div><button class="btn block">Send link</button></form><p class="hint center mt-lg"><a href="#" id="bk">Back</a></p>`);
    root.querySelector('#bk').addEventListener('click', (e) => { e.preventDefault(); loginScreen(); });
    onSubmit('#f', async () => { await AccountApp.api('POST', '/forgot', { login: val('#l') }); toast('If that account exists, a link is on its way.'); loginScreen(); });
  }
  function resetScreen(tok) {
    authShell(`<h1>New password</h1><p class="lead">Choose a new password for your account.</p><form id="f"><div class="field"><input type="password" id="p" autocomplete="new-password" required><div class="hint">At least 10 characters with letters and numbers.</div></div><button class="btn block">Save password</button></form>`);
    onSubmit('#f', async () => { await AccountApp.api('POST', '/reset', { token: tok, password: val('#p') }); history.replaceState(null, '', '/app/'); toast('Password updated — sign in'); loginScreen(); });
  }

  const billingChip = (b) => b.state === 'trial' ? `<span class="chip blue">Free trial · ${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} left</span>`
    : !b.canWrite ? '<span class="chip red">Trial ended — read-only</span>' : '';
  // [key, label, permission needed to see it]
  const NAV = [['home', 'Home', null], ['sell', 'Quick sale', 'sales.write'], ['inventory', 'Inventory', 'inventory.read'], ['customers', 'Customers', 'customers.read'], ['sales', 'Sales', 'sales.read'], ['team', 'Team', 'users.manage'], ['settings', 'Settings', 'users.manage'], ['activity', 'Activity', 'users.manage'], ['security', 'Security', null]];
  AccountApp.showShell = () => shell();
  function shell() {
    const me = AccountApp.me;
    root.innerHTML = `<header class="topbar"><div class="brand"><span class="brand-mark">▦</span>${esc(me.businessName)}</div><div class="grow"></div>${billingChip(me.billing)}<span class="muted text-sm">${esc(me.username)} · ${esc(me.role)}</span><button class="btn secondary small" id="out">Sign out</button></header>
      <div class="shell"><nav class="side">${NAV.filter(([, , p]) => !p || AccountApp.can(p)).map(([k, l]) => `<a href="#/${k}" data-k="${k}"><span>${l}</span></a>`).join('')}</nav><main class="main" id="main"></main></div>`;
    root.querySelector('#out').addEventListener('click', () => AccountApp.signOut());
    window.removeEventListener('hashchange', AccountApp.route); window.addEventListener('hashchange', AccountApp.route); AccountApp.route();
  }
  AccountApp.route = async () => {
    const k = (location.hash.replace(/^#\//, '') || 'home').split('/')[0], key = AccountApp.views[k] ? k : 'home';
    root.querySelectorAll('.side a').forEach(a => a.classList.toggle('active', a.dataset.k === key));
    const main = root.querySelector('#main'); if (!main) return;
    try { await AccountApp.fresh(); await AccountApp.views[key](main); } catch (e) { if (e.status === 401) return boot(); swap(main, `<div class="card"><p class="banner red">${esc(e.message)}</p></div>`); }
  };
  boot();
})();
