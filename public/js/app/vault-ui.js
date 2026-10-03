// APP / vault-ui — encryption screens: first-time setup, unlock, recovery key, and moving older items into encrypted storage.
(() => {
  const { esc, toast } = UI;
  const S = AccountApp.vault = { adk: null, state: null };
  S.clear = () => { S.adk = null; S.state = null; AccountApp.store.reset(); };
  const api = (...a) => AccountApp.api(...a);
  const form = (sel, fn) => AccountApp.root.querySelector(sel).addEventListener('submit', (e) => { e.preventDefault(); UI.busy(AccountApp.root.querySelector(sel + ' button.block'), async () => { try { await fn(); } catch (er) { toast(er.message, true); } }); });
  const val = (id) => AccountApp.root.querySelector(id).value;
  const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const signOutLink = '<p class="hint center mt-lg"><a href="#" id="so">Sign out</a></p>';
  const wireSignOut = () => AccountApp.root.querySelector('#so')?.addEventListener('click', async (e) => { e.preventDefault(); await AccountApp.signOut(); });

  // Shows the recovery key once and does not continue until the person says they saved it.
  const showRecovery = (text, title = 'Save your recovery key') => new Promise((resolve) => {
    const groups = text.split('-').map(g => `<b>${esc(g)}</b>`).join('');
    AccountApp.authShell(`<h1>${esc(title)}</h1><p class="lead">This key is the only way to get your data back if everyone forgets their password. We cannot see it or recover it for you.</p>
      <div class="recovery-key">${groups}</div>
      <div class="row wrap mb-lg"><button class="btn secondary small" id="dl">Download</button><button class="btn secondary small" id="pr">Print</button></div>
      <label class="check"><input type="checkbox" id="ok"><span>I have saved my recovery key somewhere safe</span></label>
      <button class="btn block mt-lg" id="go" disabled>Continue</button>`);
    const r = AccountApp.root;
    r.querySelector('#dl').addEventListener('click', () => download('myboxstock-recovery-key.txt', `myBoxStock recovery key\n${AccountApp.me.businessName}\n\n${text}\n\nKeep this somewhere safe. Anyone with this key can open your account data.\n`));
    r.querySelector('#pr').addEventListener('click', () => window.print());
    r.querySelector('#ok').addEventListener('change', (e) => { r.querySelector('#go').disabled = !e.target.checked; });
    r.querySelector('#go').addEventListener('click', async () => { try { await api('POST', '/vault/recovery/confirm'); resolve(); } catch (e) { toast(e.message, true); } });
  });

  const askPassword = ({ title, lead, button, extra = '', onSubmit, below = signOutLink }) => new Promise((resolve) => {
    AccountApp.authShell(`<h1>${esc(title)}</h1><p class="lead">${lead}</p><form id="f">${extra}<div class="field"><label>Your password</label><input type="password" id="pw" autocomplete="current-password" required></div><button class="btn block">${esc(button)}</button></form>${below}`);
    wireSignOut();
    form('#f', async () => { await onSubmit(val('#pw')); resolve(); });
    AccountApp.root.querySelector('#pw').focus();
  });

  async function migrateLegacy() {
    const old = await api('GET', '/vault/legacy'); if (!old.length) return 0;
    for (let i = 0; i < old.length; i += 200) {
      const puts = [];
      for (const o of old.slice(i, i + 200)) { const id = Vault.newId(); puts.push({ id, type: 'item', rev: 0, blob: await Vault.seal(S.adk, { uid: o.uid || '', serial: o.serial || '', mac: o.mac || '', model: o.model || '', cond: o.cond || 'New', cost: Number(o.cost) || 0, price: 0, status: o.status || 'available', supplier: '', notes: o.notes || '', addedAt: Number(o.created_at) || Date.now() }, id, 'item') }); }
      await api('POST', '/vault/batch', { puts });
    }
    await api('POST', '/vault/legacy/clear'); return old.length;
  }

  async function setup(password) {
    const adk = await Vault.newAdk(), rec = Vault.newRecoveryKey();
    await api('POST', '/vault/enable', { keys: await Vault.keysFor(password, adk), recoveryWrappedAdk: await Vault.wrapWithRecovery(adk, rec.text) });
    S.adk = adk; const moved = await migrateLegacy(); if (moved) toast(`${moved} existing item${moved === 1 ? '' : 's'} moved into encrypted storage`);
    await showRecovery(rec.text);
  }
  S.newRecovery = async () => {
    const rec = Vault.newRecoveryKey();
    await api('POST', '/vault/recovery/rotate', { recoveryWrappedAdk: await Vault.wrapWithRecovery(S.adk, rec.text) });
    await showRecovery(rec.text, 'Your new recovery key');
  };

  // Get the account key back using the recovery key, then protect it with the person's current password again.
  const recoverAccess = () => new Promise((resolve) => {
    AccountApp.authShell(`<h1>Use your recovery key</h1><p class="lead">Your password no longer unlocks your data. Enter the recovery key you saved when the account was set up.</p>
      <form id="f"><div class="field"><label>Recovery key</label><input type="text" id="rk" autocomplete="off" autocapitalize="characters" required></div>
      <div class="field"><label>Your current password</label><input type="password" id="pw" autocomplete="current-password" required><div class="hint">Your data will unlock with this password from now on.</div></div><button class="btn block">Restore access</button></form>
      <p class="hint center mt-lg">No recovery key? Ask an Administrator in your account to reset your access.</p>${signOutLink}`);
    wireSignOut();
    form('#f', async () => {
      let adk; try { adk = await Vault.unwrapWithRecovery((await api('GET', '/vault/recovery')).wrappedAdk, val('#rk')); } catch { throw new Error('That recovery key does not match this account. Check it and try again.'); }
      await api('PUT', '/vault/keys/me', { keys: await Vault.keysFor(val('#pw'), adk) }); S.adk = adk; resolve();
    });
  });

  const unlockScreen = (v) => new Promise((resolve) => {
    AccountApp.authShell(`<h1>Unlock your data</h1><p class="lead">Your data is encrypted. Enter your password to open it on this device.</p>
      <form id="f"><div class="field"><label>Your password</label><input type="password" id="pw" autocomplete="current-password" required></div><button class="btn block">Unlock</button></form>
      <p class="hint center mt-lg"><a href="#" id="rc">Forgot it? Use your recovery key</a></p>${signOutLink}`);
    wireSignOut(); AccountApp.root.querySelector('#pw').focus();
    AccountApp.root.querySelector('#rc').addEventListener('click', async (e) => { e.preventDefault(); await recoverAccess(); resolve(); });
    form('#f', async () => { try { S.adk = await Vault.unlock(val('#pw'), v.keys); } catch { throw new Error('That password does not unlock your data. If you changed it recently, use your recovery key.'); } resolve(); });
  });

  // Called after every sign-in / page load. Resolves when the account key is in memory and the app can open.
  S.gate = async (me, pw) => {
    const v = S.state = me.vault || { enabled: false }, admin = me.user.role === 'Administrator';
    if (!v.enabled) {
      if (!admin) { AccountApp.authShell(`<h1>Almost ready</h1><p class="lead">An Administrator needs to sign in once to turn on encryption for your account. Please ask them, then sign in again.</p>${signOutLink}`); wireSignOut(); return false; }
      const lead = `Your inventory, customers and sales will be encrypted in your browser so that only your team can read them — not even the hosting service can. You will get a recovery key to keep.${v.legacyItems ? ` Your ${v.legacyItems} existing item${v.legacyItems === 1 ? '' : 's'} will be moved over.` : ''}`;
      if (pw) await setup(pw); else await askPassword({ title: 'Turn on encryption', lead: esc(lead), button: 'Turn on', onSubmit: setup });
      return true;
    }
    if (S.adk) return true;
    if (!v.keys) { await recoverAccess(); return true; }
    if (pw) { try { S.adk = await Vault.unlock(pw, v.keys); } catch {} }
    if (!S.adk) await unlockScreen(v);
    if (admin && v.recoveryConfirmed === false) await S.newRecovery(); // a recovery key was made but never confirmed saved
    return true;
  };

  // Forced or voluntary password change: re-wrap the account key under the new password so access is never lost.
  S.keysForNewPassword = async (current, next) => {
    const v = S.state; if (!v?.enabled) return undefined;
    let adk = S.adk; if (!adk && v.keys) { try { adk = await Vault.unlock(current, v.keys); } catch { throw new Error('Current password is incorrect.'); } }
    if (!adk) return undefined; S.adk = adk; return Vault.keysFor(next, adk);
  };
})();
