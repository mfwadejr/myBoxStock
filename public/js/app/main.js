// APP / main — sign-in, sign-up, reset screens, page shell and router. Views live in views/*.js.
(() => {
  const { esc, toast, busy, swap } = UI;
  const root = document.getElementById('root');
  AccountApp.api = UI.client('/api/app');
  AccountApp.me = null;
  AccountApp.can = (p) => AccountApp.me.perms.includes('*') || AccountApp.me.perms.includes(p);
  let cfg = { signupsEnabled: true, trialDays: 14 };

  const authShell = (inner) => { root.innerHTML = `<main class="authwrap"><div class="authcard"><img class="logo" src="/assets/logo-512.png" alt="myBoxStock" width="512" height="512">${inner}${UI.legal.links(false, true)}</div></main>`; };
  AccountApp.root = root; AccountApp.authShell = authShell; AccountApp.pw = null; // the password typed at sign-in, held only until the data is unlocked
  AccountApp.signOut = async () => { clearInterval(AccountApp.badgeTimer); try { await AccountApp.api('POST', '/logout'); } catch {} AccountApp.me = null; AccountApp.pw = null; AccountApp.vault.clear(); loginScreen(); };
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
    const cf = location.hash.match(/^#\/confirm\/(.+)$/); if (cf) return confirmScreen(cf[1]);
    const dm = location.hash.match(/^#\/demo\/(.+)$/); if (dm) return demoOpen(dm[1]);
    try { const r = await AccountApp.api('GET', '/me'); UI.setCsrf(r.csrf); AccountApp.me = r.user; AccountApp.announcement = r.announcement || null; AccountApp.vault.state = r.vault; if (r.mfaPending) return mfaScreen(); if (r.mustChange) return changePwScreen(); if (r.user.termsRequired) return AccountApp.termsScreen(); if (!await AccountApp.vault.gate(r, AccountApp.pw)) return; AccountApp.pw = null; await AccountApp.store.load(); await AccountApp.vault.policy(); return shell(); }
    catch (e) { if (/^#\/legal(\/|$)/.test(location.hash)) return AccountApp.legalScreen(); if (location.hash === '#/signup' && cfg.signupsEnabled) signupScreen(); else loginScreen(); if (e && e.status !== 401) toast(e.message || 'Sign-in could not finish. Please try again.', true); }
  }
  // This browser remembers the Reseller ID (not the password) so next time only the username is needed.
  const rememberedId = () => { try { return localStorage.getItem('mbs.resellerId') || ''; } catch { return ''; } };
  const rememberId = (v) => { try { localStorage.setItem('mbs.resellerId', v); } catch {} };
  function loginScreen() {
    authShell(`${modeSwitch('login')}<h1>myBoxStock</h1><p class="lead">Sign in to your account.</p>
      <form id="f"><div class="field"><label for="r">Reseller ID</label><input type="text" id="r" placeholder="amber-fox-4271" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="organization" required><div class="hint">It was in your welcome email, and your account administrator can tell you.</div></div>
      <div class="field"><label for="l">Username</label><input type="text" id="l" autocapitalize="none" autocorrect="off" autocomplete="username" required></div>
      <div class="field"><label for="p">Password</label><input type="password" id="p" autocomplete="current-password" required></div><button class="btn block">Sign in</button></form>
      <p class="hint center mt-lg"><a href="#" id="fg">Forgot password?</a>${cfg.signupsEnabled ? ' · <a href="#" id="su">Create an account</a>' : ''}</p>`);
    wireSwitch();
    root.querySelector('#r').value = rememberedId();
    { const m = location.hash.match(/^#\/u\/(.+)$/); if (m) { const v = decodeURIComponent(m[1]), i = v.lastIndexOf('@'); root.querySelector('#l').value = i < 0 ? v : v.slice(0, i); if (i >= 0) root.querySelector('#r').value = v.slice(i + 1); } } // opened from the Host Console link list
    root.querySelector(root.querySelector('#r').value ? (root.querySelector('#l').value ? '#p' : '#l') : '#r').focus();
    root.querySelector('#fg').addEventListener('click', (e) => { e.preventDefault(); forgotScreen(); });
    root.querySelector('#su')?.addEventListener('click', (e) => { e.preventDefault(); signupScreen(); });
    onSubmit('#f', async () => { AccountApp.pw = val('#p'); let r; try { r = await AccountApp.api('POST', '/login', { resellerId: val('#r'), username: val('#l'), password: AccountApp.pw }); } catch (e) { AccountApp.pw = null; throw e; } rememberId(val('#r').trim().toLowerCase()); UI.setCsrf(r.csrf); if (r.mfa) return mfaScreen(); await boot(); });
  }
  // "Open as this reseller" from the Host console (Demo mode): a one-time ticket supplies the demo login's details, and the normal sign-in form is submitted with them.
  async function demoOpen(ticket) {
    history.replaceState(null, '', '/app/');
    try {
      const c = await AccountApp.api('POST', '/demo-open', { ticket }); loginScreen();
      root.querySelector('#r').value = c.resellerId; root.querySelector('#l').value = c.username; root.querySelector('#p').value = c.password; root.querySelector('#f').requestSubmit();
    } catch (e) { loginScreen(); toast(e.message || 'That sign-in link could not be used.', true); }
  }
  function mfaScreen() {
    authShell(`<h1>Two-factor code</h1><p class="lead">Enter the 6-digit code from your authenticator app, or a recovery code.</p>
      <form id="f"><div class="field"><input type="text" class="codeinput" id="c" aria-label="Sign-in code" autocomplete="one-time-code" autofocus></div><button class="btn block">Verify</button></form>`);
    onSubmit('#f', async () => { await AccountApp.api('POST', '/login/mfa', { code: val('#c') }); await boot(); });
  }
  function changePwScreen() {
    authShell(`<h1>Choose a new password</h1><p class="lead">Replace your temporary password to continue.</p>
      <form id="f"><div class="field"><label for="a">Current password</label><input type="password" id="a" autocomplete="current-password" required></div><div class="field"><label for="b">New password</label><input type="password" id="b" autocomplete="new-password" required><div class="hint">At least 10 characters with letters and numbers.</div></div><button class="btn block">Update password</button></form>`);
    onSubmit('#f', async () => { const keys = await AccountApp.vault.keysForNewPassword(val('#a'), val('#b')); await AccountApp.api('POST', '/change-password', { current: val('#a'), next: val('#b'), keys }); AccountApp.pw = val('#b'); await boot(); });
  }
  function signupScreen() {
    authShell(`${modeSwitch('signup')}<h1>Create your account</h1><p class="lead">Track inventory and sales for your business. Free for ${esc(cfg.trialDays)} days — no card needed.</p>
      <form id="f"><div class="field"><label for="bn">Business name</label><input type="text" id="bn" required></div><div class="field"><label for="em">Email</label><input type="email" id="em" autocomplete="email" required></div>
      <div class="field"><label for="un">Username</label><input type="text" id="un" autocapitalize="none" autocomplete="username" required></div><div class="field"><label for="pw">Password</label><input type="password" id="pw" autocomplete="new-password" required><div class="hint">At least 10 characters with letters and numbers.</div></div>
      <div class="field"><label class="check tap"><input type="checkbox" id="tc" aria-required="true" aria-describedby="tc-err"><span>I agree to the <a href="#/legal/terms-of-service" target="_blank" rel="noopener">Terms of Service</a> and <a href="#/legal/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a></span></label><div class="hint danger-text" id="tc-err" role="alert" hidden>Tick the box to agree to the Terms of Service and Privacy Policy before creating your account.</div></div>
      <button class="btn block">Create account</button></form><p class="hint center mt-lg"><a href="#" id="bk">Back to sign in</a></p>`);
    wireSwitch();
    root.querySelector('#bk').addEventListener('click', (e) => { e.preventDefault(); loginScreen(); });
    const tc = root.querySelector('#tc'), tcErr = root.querySelector('#tc-err');
    tc.addEventListener('change', () => { tcErr.hidden = tc.checked; tc.removeAttribute('aria-invalid'); });
    onSubmit('#f', async () => {
      if (!tc.checked) { tcErr.hidden = false; tc.setAttribute('aria-invalid', 'true'); tc.focus(); return; }
      const r = await AccountApp.api('POST', '/signup', { businessName: val('#bn'), email: val('#em'), username: val('#un'), password: val('#pw'), acceptTerms: true, termsVersion: cfg.termsVersion });
      authShell(`<h1>You’re all set</h1><p class="lead">Keep your Reseller ID — you need it, with your username, to sign in.</p><div class="codeblock large">${esc(r.resellerId)}</div><p class="hint center my-lg">Username <b>${esc(r.username)}</b>. We’ve also emailed these to you. This browser will remember the ID.</p><button class="btn block" id="go">Continue to sign in</button>`);
      rememberId(r.resellerId); root.querySelector('#go').addEventListener('click', loginScreen);
    });
  }
  function forgotScreen() {
    authShell(`<h1>Reset password</h1><p class="lead">Enter the email address on your account and we’ll send a reset link for each account that uses it.</p>${cfg.emailReady === false ? '<div class="banner mb-lg" id="nomail">This site cannot send email right now, so reset links cannot be sent. Ask an Administrator on your account to set a temporary password for you, or ask the person who runs this site.</div>' : ''}<div class="banner blue mb-lg" id="resetnote">Resetting your password gets you back into your login. Your business data stays locked until you enter your recovery key or an Administrator unlocks it for you.</div><form id="f"><div class="field"><label for="l">Email</label><input type="email" id="l" autocapitalize="none" autocomplete="email" required></div><button class="btn block">Send link</button></form><p class="hint center mt-lg"><a href="#" id="bk">Back</a></p>`);
    root.querySelector('#bk').addEventListener('click', (e) => { e.preventDefault(); loginScreen(); });
    onSubmit('#f', async () => { await AccountApp.api('POST', '/forgot', { email: val('#l') }); toast('If that email is on an account, a link is on its way.'); loginScreen(); });
  }
  async function confirmScreen(tok) {
    let ok = true; try { await AccountApp.api('POST', '/confirm-email', { token: tok }); } catch (e) { ok = false; }
    history.replaceState(null, '', '/app/');
    authShell(ok ? `<h1>Email confirmed</h1><p class="lead">Thank you. Your email address is confirmed.</p><button class="btn block" id="go">Continue</button>` : `<h1>Link not valid</h1><p class="lead">This confirmation link has expired or was already used. Sign in and ask for a new one from the banner at the top of Home.</p><button class="btn block" id="go">Continue</button>`);
    root.querySelector('#go').addEventListener('click', () => boot());
  }
  // After a reset: say plainly what is and is not back (the login is; the business data waits for the recovery key or another Administrator).
  function resetDone() {
    authShell(`<h1>Password updated</h1><p class="lead">Resetting your password gets you back into your login. Your business data stays locked until you enter your recovery key or an Administrator unlocks it for you.</p><button class="btn block" id="go">Continue to sign in</button>`);
    root.querySelector('#go').addEventListener('click', loginScreen);
  }
  function resetScreen(tok) {
    authShell(`<h1>New password</h1><p class="lead">Choose a new password for your account.</p><div class="banner blue mb-lg" id="resetnote">Resetting your password gets you back into your login. Your business data stays locked until you enter your recovery key or an Administrator unlocks it for you.</div><form id="f"><div class="field"><label for="p">New password</label><input type="password" id="p" autocomplete="new-password" required><div class="hint">At least 10 characters with letters and numbers.</div></div><button class="btn block">Save password</button></form>`);
    onSubmit('#f', async () => { await AccountApp.api('POST', '/reset', { token: tok, password: val('#p') }); history.replaceState(null, '', '/app/'); toast('Password updated — sign in'); resetDone(); });
  }

  const billingChip = (b) => b.state === 'trial' ? `<span class="chip blue">Free trial · ${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} left</span>`
    : !b.canWrite ? '<span class="chip red">Trial ended — read-only</span>' : '';
  // [key, label, permission needed to see it]
  const NAV = [['home', 'Home', null], ['sell', 'Quick sale', 'sales.write'], ['inventory', 'Inventory', 'inventory.read'], ['customers', 'Customers', 'customers.read'], ['sales', 'Sales', 'sales.read'], ['team', 'Team', 'users.manage'], ['settings', 'Settings', 'users.manage'], ['backup', 'Backup and restore', 'users.manage'], ['activity', 'Activity', 'users.manage'], ['security', 'Security', null], ['docs', 'Documentation', null], ['support', 'Support', null]];
  const PRIMARY = ['home', 'sell', 'inventory', 'customers']; // the phone tab bar; everything else is under More
  const visibleNav = () => NAV.filter(([, , p]) => !p || AccountApp.can(p)).map(([k, l]) => [k, l]);
  AccountApp.showShell = () => shell();
  function shell() {
    const me = AccountApp.me;
    root.innerHTML = `<header class="topbar"><div class="brand"><a class="brand-link" href="#/home" aria-label="Home"><img class="brand-mark" src="/assets/logo-512.png" alt="myBoxStock" width="512" height="512"></a><span class="brand-name">${esc(me.businessName)}</span></div><div class="grow"></div>${billingChip(me.billing)}<span id="acct"></span></header>
      <div class="shell"><nav class="side" aria-label="Main menu">${visibleNav().map(([k, l]) => `<a href="#/${k}" data-k="${k}">${AccountApp.icons[k] || ''}<span>${l}</span></a>`).join('')}</nav><main class="main" id="main"></main></div>${UI.legal.footer()}${UI.tabbar.html(visibleNav(), PRIMARY, AccountApp.icons)}`;
    UI.tabbar.bind(root, visibleNav(), PRIMARY, AccountApp.icons, {});
    const menuItems = (n) => [{ id: 'support', label: 'Support', badge: n || 0 }, ...(me.hostLinked ? [{ id: 'host', label: 'Site admin' }] : []), { id: 'out', label: 'Sign out', sep: true }];
    AccountApp.menu = UI.menu.mount(root.querySelector('#acct'), { name: me.username, head: `<b>${esc(me.username)}</b><span>${esc(me.role)}</span><span>${esc(me.businessName)}</span>`, items: menuItems(0),
      pick: (id) => { if (id === 'support') location.hash = '#/support'; else if (id === 'host') window.open('/host/', '_blank', 'noopener'); else if (id === 'out') AccountApp.signOut(); } });
    // The number of replies from the myBoxStock team that have not been read yet, shown beside the name and beside Support in the menu.
    AccountApp.supportBadge = async () => { try { const { n } = await AccountApp.api('GET', '/support/unread'); AccountApp.menu?.update({ badge: n, items: menuItems(n) }); UI.tabbar.setBadges(root, PRIMARY, { support: n }, 'new replies'); } catch {} };
    clearInterval(AccountApp.badgeTimer); AccountApp.badgeTimer = setInterval(() => AccountApp.supportBadge(), 120000);
    window.removeEventListener('hashchange', AccountApp.route); window.addEventListener('hashchange', AccountApp.route); AccountApp.route();
  }
  // A closing account shows its erase date on every page, with a way back.
  function closingBanner(main) {
    const me = AccountApp.me; if (!me.closingAt) return;
    main.insertAdjacentHTML('afterbegin', `<div class="banner red row spread wrap mb-lg" id="cb"><span>This account is closing and will be erased on ${esc(AccountApp.fmt.day(me.closingAt))}. Until then it is read-only.</span>${AccountApp.can('users.manage') ? '<button class="btn secondary small" id="cbr">Restore account</button>' : ''}</div>`);
    main.querySelector('#cbr')?.addEventListener('click', async () => { try { await AccountApp.api('POST', '/account/restore'); const r = await AccountApp.api('GET', '/me'); AccountApp.me = r.user; toast('Account restored'); AccountApp.route(); } catch (er) { toast(er.message, true); } });
  }
  // A demo login (made by Host > Demo mode) says so on every page.
  function demoBanner(main) {
    if (!AccountApp.me?.demo) return;
    main.insertAdjacentHTML('afterbegin', '<div class="banner row spread wrap mb-lg" id="demo-bar" role="status"><span><span class="chip amber">DEMO</span> This is a demo account with made-up data. Nothing here is real, and no email is sent from it.</span></div>');
  }
  // The Host administrator's announcement: a banner on every page until the person closes it (it comes back when the message changes).
  const ANN = { info: 'blue', warning: '', important: 'red' };
  const dismissed = () => { try { return localStorage.getItem('mbs-ann'); } catch { return null; } };
  function announcementBanner(main) {
    const a = AccountApp.announcement; if (!a || dismissed() === a.id) return;
    main.insertAdjacentHTML('afterbegin', `<div class="banner ${ANN[a.level] || 'blue'} row spread wrap mb-lg" id="ab" role="status"><span>${esc(a.text)}</span><button class="btn secondary small" id="abx">Close</button></div>`);
    main.querySelector('#abx').addEventListener('click', () => { try { localStorage.setItem('mbs-ann', a.id); } catch {} main.querySelector('#ab')?.remove(); });
  }
  let annAt = Date.now();
  // Soft email confirmation: a banner on Home and Security until the address is confirmed.
  function emailBanner(main) {
    const me = AccountApp.me; if (!me.emailBanner) return;
    main.insertAdjacentHTML('afterbegin', `<div class="banner blue row spread wrap mb-lg" id="eb"><span>Confirm your email address${me.emailHeld ? ' to use password reset by email and add people to your team' : ''}. We sent a link to ${esc(me.email)}.</span><button class="btn secondary small" id="ebr">Send it again</button></div>`);
    main.querySelector('#ebr').addEventListener('click', async (e) => { try { await AccountApp.api('POST', '/email/resend'); toast('Sent. Check your inbox.'); } catch (er) { toast(er.message, true); } });
  }
  AccountApp.route = async () => {
    const k = (location.hash.replace(/^#\//, '') || 'home').split('/')[0], key = AccountApp.views[k] ? k : 'home';
    UI.tabbar.mark(root, key, PRIMARY);
    const main = root.querySelector('#main'); if (!main) return;
    try { await AccountApp.fresh(); if (Date.now() - annAt > 120000) { annAt = Date.now(); AccountApp.announcement = (await AccountApp.api('GET', '/announcement')).announcement; } await AccountApp.views[key](main); if (key === 'home' || key === 'security') emailBanner(main); closingBanner(main); announcementBanner(main); demoBanner(main); AccountApp.supportBadge?.(); } catch (e) { if (e.status === 401 || e.data?.code === 'TERMS_ACCEPT_REQUIRED') return boot(); swap(main, `<div class="card"><p class="banner red">${esc(e.message)}</p></div>`); }
  };
  AccountApp.boot = boot;
  boot();
})();
