// HOST / views / accounts — search accounts; support actions per account and user (never business data).
(() => {
  const { esc, fmt, toast, sheet, confirmBox, busy, swap } = UI;

  const PLAN_CHIP = { trial: ['blue', 'Trial'], trial_expired: ['red', 'Trial ended'], free: ['green', 'Free'], paid: ['green', 'Paid'], paid_expired: ['red', 'Paid ended'] };
  const planChip = (b) => { const [c, l] = PLAN_CHIP[b.state]; return `<span class="chip ${c}">${l}${b.daysLeft != null && b.canWrite ? ` · ${b.daysLeft}d left` : ''}</span>`; };

  Host.views.accounts = async (main) => {
    let q = '', plan = '';
    const load = async () => {
      const rows = await Host.api('GET', '/accounts?q=' + encodeURIComponent(q) + '&plan=' + encodeURIComponent(plan));
      main.querySelector('#tbl').innerHTML = rows.length ? `<table><thead><tr><th>Business</th><th>Account ID</th><th>Owner</th><th>Users</th><th>Plan</th><th>Status</th><th>Last active</th></tr></thead><tbody>${rows.map(a => `
        <tr class="click" data-id="${a.id}"><td><b>${esc(a.business_name)}</b></td><td class="mono">${esc(a.account_code)}</td><td class="muted">${esc(a.owner_email)}</td><td>${a.user_count}</td><td>${planChip(a.billing)}</td>
        <td><span class="chip ${a.status === 'active' ? 'green' : 'red'}">${esc(a.status)}</span></td><td class="muted">${fmt.ago(a.last_activity)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No accounts yet.</div>';
    };
    swap(main, `${Host.head('Accounts', 'Support tools for signed-up businesses. Their inventory, sales and customers are private and never shown here.')}
      <div class="card"><div class="row wrap"><div class="field grow"><input type="search" id="q" placeholder="Search by business, account ID or email"></div>
        <div class="field">${UI.select.html({ id: 'pf', options: [['', 'All plans'], ['trial', 'On trial'], ['free', 'Free (comped)'], ['paid', 'Paid'], ['expired', 'Ended / read-only']] })}</div></div><div class="tablewrap" id="tbl"></div></div>`);
    let t; main.querySelector('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; load(); }, 250); });
    main.querySelector('#pf').addEventListener('change', (e) => { plan = UI.select.value(e.target); load(); });
    main.querySelector('#tbl').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) accountSheet(tr.dataset.id, load); });
    await load();
  };

  async function accountSheet(id, refresh) {
    const d = await Host.api('GET', `/accounts/${id}`), a = d.account;
    const rows = d.users.map(u => `<div class="setting"><div><div class="setting-title">${esc(u.username)} <span class="chip">${esc(u.role)}</span> ${u.totp_enabled ? '<span class="chip green">2FA</span>' : ''} ${u.disabled ? '<span class="chip red">disabled</span>' : ''}</div>
      <div class="setting-desc">${esc(u.login)} · last sign-in ${fmt.ago(u.last_login)}</div></div><button class="btn secondary small" data-u="${u.id}">Manage</button></div>`).join('');
    await sheet(`<div class="row spread"><h2>${esc(a.business_name)}</h2><span class="chip ${a.status === 'active' ? 'green' : 'red'}">${esc(a.status)}</span></div>
      <p class="muted"><span class="mono">${esc(a.account_code)}</span> · created ${fmt.date(a.created_at)}</p>
      <div class="banner blue my-md">You can help with sign-in and security. Business data is not visible to host administrators.</div>
      <h3 class="mt-sm">Plan</h3>
      <div class="setting"><div><div class="setting-title">${planChip(a.billing)} ${a.plan_note ? `<span class="muted text-sm">${esc(a.plan_note)}</span>` : ''}</div>
        <div class="setting-desc">${a.billing.endsAt ? `${a.billing.canWrite ? 'Ends' : 'Ended'} ${fmt.date(a.billing.endsAt)}` : a.plan === 'free' ? 'Free account — never expires' : 'No end date'}${a.billing.canWrite ? '' : ' · account is read-only'}</div></div>
        <button class="btn secondary small" id="plan">Change plan</button></div>
      ${d.history.length ? `<details class="mt-sm"><summary class="muted text-sm">Plan history (${d.history.length})</summary>${d.history.map(h => `<div class="setting-desc">${fmt.date(h.ts)} · ${esc(h.kind.replace(/_/g, ' '))}${h.to_plan && h.kind.startsWith('plan') ? ` → ${esc(h.to_plan)}` : ''} · ${esc(h.actor || '')}${h.note ? ` — ${esc(h.note)}` : ''}</div>`).join('')}</details>` : ''}
      <h3 class="mt-sm">People</h3>${rows}
      <div class="actions split"><div class="row"><button class="btn secondary small" id="sus">${a.status === 'active' ? 'Suspend' : 'Reactivate'}</button><button class="btn danger small" id="del">Delete</button></div><button class="btn" data-cancel>Done</button></div>`, {
      onMount: (el, close) => {
        el.querySelector('#plan').addEventListener('click', () => { close(); planSheet(a, () => accountSheet(id, refresh)); });
        el.querySelector('#sus').addEventListener('click', async () => { await Host.api('POST', `/accounts/${id}/status`, { status: a.status === 'active' ? 'suspended' : 'active' }); toast('Updated'); close(); refresh(); });
        el.querySelector('#del').addEventListener('click', async () => {
          close();
          const c = await confirmBox({ title: 'Delete account?', body: 'This permanently erases the account, its users and all of its data. It cannot be undone.', confirmLabel: 'Delete forever', danger: true, typeToConfirm: a.account_code });
          if (c) { try { await Host.api('DELETE', `/accounts/${id}`, { confirm: c }); toast('Account deleted'); refresh(); } catch (er) { toast(er.message, true); } }
        });
        el.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => { const u = d.users.find(x => x.id === b.dataset.u); close(); userSheet(a, u, () => accountSheet(id, refresh)); }));
      } });
  }

  async function userSheet(a, u, back) {
    await sheet(`<h2>${esc(u.username)}</h2><p class="muted mono">${esc(u.login)}</p>
      <div class="stack mt-lg">
        <button class="btn secondary" id="link" ${u.email ? '' : 'disabled'}>Email a password reset link</button>
        <button class="btn secondary" id="tmp">Set a temporary password</button>
        <button class="btn secondary" id="mfa" ${u.totp_enabled ? '' : 'disabled'}>Reset two-factor authentication</button>
        <button class="btn ${u.disabled ? 'secondary' : 'danger'}" id="dis">${u.disabled ? 'Enable sign-in' : 'Disable sign-in'}</button>
        <button class="btn danger" id="rm">Delete this user</button></div>
      <div class="actions"><button class="btn" data-cancel>Back</button></div>`, { onMount: (el, close) => {
        const act = (sel, fn) => el.querySelector(sel).addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await fn(); } catch (er) { toast(er.message, true); } }));
        act('#link', async () => { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/reset-link`); toast('Reset link queued for ' + u.email); });
        act('#tmp', async () => {
          const r = await Host.api('POST', `/accounts/${a.id}/users/${u.id}/temp-password`); close();
          await sheet(`<h2>Temporary password</h2><p class="muted">Share this securely with ${esc(u.username)}. They must change it at next sign-in, and it is shown only now.</p><div class="codeblock mt-md">${esc(r.tempPassword)}</div><div class="actions"><button class="btn" data-cancel>Done</button></div>`);
        });
        act('#mfa', async () => { const ok = await confirmBox({ title: 'Reset two-factor?', body: `${esc(u.username)} will be signed out and must set up two-factor again.`, confirmLabel: 'Reset' }); if (ok) { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/reset-mfa`); toast('Two-factor reset'); close(); } });
        act('#rm', async () => {
          close(); const c = await confirmBox({ title: 'Delete user?', body: `${esc(u.login)} is removed from the account and can no longer sign in. This cannot be undone.`, confirmLabel: 'Delete user', danger: true, typeToConfirm: u.login });
          if (c) { try { await Host.api('DELETE', `/accounts/${a.id}/users/${u.id}`, { confirm: c }); toast('User deleted'); } catch (er) { toast(er.message, true); } }
          back();
        });
        act('#dis', async () => { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/disabled`, { disabled: !u.disabled }); toast('Updated'); close(); });
      } });
    back();
  }

  // Change plan: free (comped), trial (start / extend), paid. Everything is recorded in the account's plan history.
  async function planSheet(a, back) {
    await sheet(`<h2>Change plan</h2><p class="muted">${esc(a.business_name)} · <span class="mono">${esc(a.account_code)}</span></p>
      <div class="field mt-md"><label>Plan</label>${UI.select.html({ id: 'pl', value: ['free', 'trial', 'paid'].includes(a.plan) ? a.plan : 'free', options: [['free', 'Free — comped, never expires'], ['trial', 'Free trial'], ['paid', 'Paid']] })}</div>
      <div class="field" id="f-days"><label>Trial length (days)</label><input type="number" id="days" min="1" max="730" value="14"><label class="check mt-sm"><input type="checkbox" id="ext"> Add to the current end date instead of starting today</label></div>
      <div class="field" id="f-until"><label>Paid through (optional)</label><input type="date" id="until"><div class="hint">Leave empty for no end date.</div></div>
      <div class="field"><label>Note (only you see this)</label><input type="text" id="note" maxlength="255" placeholder="e.g. Comped for launch partner"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save plan</button></div>`, { onMount: (el, close) => {
        const pl = el.querySelector('#pl'), plan = () => UI.select.value(pl);
        const sync = () => { el.querySelector('#f-days').hidden = plan() !== 'trial'; el.querySelector('#f-until').hidden = plan() !== 'paid'; };
        pl.addEventListener('change', sync); sync();
        el.querySelector('#go').addEventListener('click', (e) => busy(e.currentTarget, async () => {
          try { await Host.api('POST', `/accounts/${a.id}/plan`, { plan: plan(), days: Number(el.querySelector('#days').value), extend: el.querySelector('#ext').checked, until: el.querySelector('#until').value, note: el.querySelector('#note').value }); toast('Plan updated'); close(); }
          catch (er) { toast(er.message, true); }
        }));
      } });
    back();
  }
})();
