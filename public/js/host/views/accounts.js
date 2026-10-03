// HOST / views / accounts — search accounts; support actions per account and user (never business data).
(() => {
  const { esc, fmt, toast, sheet, confirmBox, busy, swap } = UI;

  Host.views.accounts = async (main) => {
    let q = '';
    const load = async () => {
      const rows = await Host.api('GET', '/accounts?q=' + encodeURIComponent(q));
      main.querySelector('#tbl').innerHTML = rows.length ? `<table><thead><tr><th>Business</th><th>Account ID</th><th>Owner</th><th>Users</th><th>Status</th><th>Last active</th></tr></thead><tbody>${rows.map(a => `
        <tr class="click" data-id="${a.id}"><td><b>${esc(a.business_name)}</b></td><td class="mono">${esc(a.account_code)}</td><td class="muted">${esc(a.owner_email)}</td><td>${a.user_count}</td>
        <td><span class="chip ${a.status === 'active' ? 'green' : 'red'}">${esc(a.status)}</span></td><td class="muted">${fmt.ago(a.last_activity)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No accounts yet.</div>';
    };
    swap(main, `${Host.head('Accounts', 'Support tools for signed-up businesses. Their inventory, sales and customers are private and never shown here.')}
      <div class="card"><div class="field"><input type="search" id="q" placeholder="Search by business, account ID or email"></div><div class="tablewrap" id="tbl"></div></div>`);
    let t; main.querySelector('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; load(); }, 250); });
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
      <h3 class="mt-sm">People</h3>${rows}
      <div class="actions split"><div class="row"><button class="btn secondary small" id="sus">${a.status === 'active' ? 'Suspend' : 'Reactivate'}</button><button class="btn danger small" id="del">Delete</button></div><button class="btn" data-cancel>Done</button></div>`, {
      onMount: (el, close) => {
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
        <button class="btn ${u.disabled ? 'secondary' : 'danger'}" id="dis">${u.disabled ? 'Enable sign-in' : 'Disable sign-in'}</button></div>
      <div class="actions"><button class="btn" data-cancel>Back</button></div>`, { onMount: (el, close) => {
        const act = (sel, fn) => el.querySelector(sel).addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await fn(); } catch (er) { toast(er.message, true); } }));
        act('#link', async () => { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/reset-link`); toast('Reset link queued for ' + u.email); });
        act('#tmp', async () => {
          const r = await Host.api('POST', `/accounts/${a.id}/users/${u.id}/temp-password`); close();
          await sheet(`<h2>Temporary password</h2><p class="muted">Share this securely with ${esc(u.username)}. They must change it at next sign-in, and it is shown only now.</p><div class="codeblock mt-md">${esc(r.tempPassword)}</div><div class="actions"><button class="btn" data-cancel>Done</button></div>`);
        });
        act('#mfa', async () => { const ok = await confirmBox({ title: 'Reset two-factor?', body: `${esc(u.username)} will be signed out and must set up two-factor again.`, confirmLabel: 'Reset' }); if (ok) { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/reset-mfa`); toast('Two-factor reset'); close(); } });
        act('#dis', async () => { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/disabled`, { disabled: !u.disabled }); toast('Updated'); close(); });
      } });
    back();
  }
})();
