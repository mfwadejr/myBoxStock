// APP / views / firstrun — the first-run checklist on Home (Administrators only): the steps that make a new reseller account safe and useful.
// Every tick is worked out in this browser from the account's own records and settings, so the Host sees nothing. "Dismissed" and "backup file tested" are kept in the account's
// encrypted settings record (so it follows the account to every device; the server is only told that it happened, for the activity log). "Backup file tested" is kept in this browser only,
// because Test a backup file sends and changes nothing; it ticks on the device where the test was done.
(() => {
  const { esc } = UI, A = AccountApp, S = A.store;

  // ctx: { items, sales, config, defaults, people, lastBackupAt, tested, recoveryConfirmed }. Returns the steps in order: { key, title, desc, done, optional, href, cta }.
  const samePay = (a, b) => JSON.stringify(a.methods.map(m => [m.key, m.label, !!m.archived])) === JSON.stringify(b.methods.map(m => [m.key, m.label, !!m.archived])) && a.default === b.default;
  const steps = (c) => [
    { key: 'device', title: 'Add your first device', desc: 'Add a device you have in stock under Inventory.', done: c.items > 0, href: '#/inventory', cta: 'Add a device' },
    { key: 'payments', title: 'Check your payment methods', desc: 'Make the “Paid by” choices match how your customers pay.', done: !samePay(c.config.payments, c.defaults.payments) || c.sales > 0, href: '#/settings', cta: 'Open Settings' },
    { key: 'sale', title: 'Make your first sale', desc: 'Record a sale with Quick sale to see a receipt.', done: c.sales > 0, href: '#/sell', cta: 'Quick sale' },
    { key: 'team', title: 'Add a team member', desc: 'Optional. Give a helper their own sign-in and user type.', done: c.people > 1, optional: true, href: '#/team', cta: 'Open Team' },
    { key: 'backup', title: 'Make your first backup', desc: 'Save a backup file somewhere away from this device.', done: !!c.lastBackupAt, href: '#/backup', cta: 'Back up now' },
    { key: 'tested', title: 'Test a backup file', desc: 'Prove a backup file opens with your key, before you need it.', done: !!c.tested, href: '#/backup', cta: 'Test a file' },
    { key: 'recovery', title: 'Save your recovery key', desc: 'It is the only way back in if every password is forgotten.', done: !!c.recoveryConfirmed, href: '#/security', cta: 'Open Security' },
  ];
  const finished = (list) => list.filter(s => !s.optional).every(s => s.done);

  const chip = (s) => s.done ? '<span class="chip green">Done</span>' : s.optional ? '<span class="chip">Optional</span>' : '<span class="chip amber">To do</span>';
  const row = (s) => `<div class="setting" data-step="${esc(s.key)}" data-done="${s.done ? '1' : '0'}"><div><div class="setting-title">${esc(s.title)}</div><div class="setting-desc">${esc(s.desc)}</div></div><div class="row wrap">${chip(s)}${s.done ? '' : `<a class="btn secondary small" href="${esc(s.href)}">${esc(s.cta)}</a>`}</div></div>`;

  A.firstRun = { steps, finished };

  // Called when a backup file test passes. Browser-local on purpose (a test must not send or change anything).
  const testedKey = () => `mbs.fr.tested.${A.me.accountCode}`;
  const tested = () => { try { return !!localStorage.getItem(testedKey()); } catch { return false; } };
  A.firstRunTested = () => { try { localStorage.setItem(testedKey(), String(Date.now())); } catch { /* private window: the step stays open */ } };

  A.firstRunCard = async (main) => {
    if (!A.can('users.manage') || S.config().firstRun.dismissed) return;
    let st, people;
    try { [st, people] = await Promise.all([A.api('GET', '/backup/status'), A.api('GET', '/users')]); } catch { return; }
    const config = S.config(), list = steps({ items: S.all('item').length, sales: S.all('sale').length, config, defaults: S.defaults(), tested: tested(), people: people.length, lastBackupAt: st.lastBackupAt, recoveryConfirmed: A.vault.state?.recoveryConfirmed });
    const head = main.querySelector('.page-head'); if (!main.isConnected || !head || main.querySelector('#frc') || finished(list)) return;
    const done = list.filter(s => s.done).length;
    head.insertAdjacentHTML('afterend', `<div class="card mb-lg" id="frc"><div class="card-head"><div><h3>Get set up</h3><div class="sub mb-0">A few steps to make your account useful and safe. Only you and your Administrators see this.</div></div><div class="row wrap"><span class="chip ${done === list.length ? 'green' : 'blue'}" id="frp">${done} of ${list.length} done</span><button type="button" class="btn secondary small" id="frx">Dismiss</button></div></div>${list.map(row).join('')}</div>`);
    main.querySelector('#frx').addEventListener('click', async () => {
      try { const cfg = S.config(); await S.saveConfig({ ...cfg, firstRun: { ...cfg.firstRun, dismissed: true } }); A.api('POST', '/account/firstrun-note', { event: 'dismissed' }).catch(() => {}); main.querySelector('#frc')?.remove(); }
      catch (e) { UI.toast(e.message, true); }
    });
  };
})();
