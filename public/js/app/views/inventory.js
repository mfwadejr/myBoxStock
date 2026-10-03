// APP / views / inventory — the account's devices (starter slice).
(() => {
  const { esc, toast, sheet, swap } = UI;

  AccountApp.views.inventory = async (main) => {
    const me = AccountApp.me, rows = AccountApp.can('inventory.read') ? await AccountApp.api('GET', '/inventory') : [];
    swap(main, `<div class="page-head row spread"><div><h1>Inventory</h1><p>Your devices, only visible to your account.</p></div>${AccountApp.can('inventory.write') ? '<button class="btn" id="add">Add device</button>' : ''}</div>
      <div class="card"><div class="tablewrap">${rows.length ? `<table><thead><tr><th>UID</th><th>Serial</th><th>MAC</th><th>Model</th><th>Condition</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr><td class="mono">${esc(r.uid || '—')}</td><td class="mono">${esc(r.serial || '—')}</td><td class="mono">${esc(r.mac || '—')}</td><td>${esc(r.model || '—')}</td><td>${esc(r.cond || '')}</td><td><span class="chip green">${esc(r.status)}</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No devices yet.</div>'}</div></div>`);
    main.querySelector('#add')?.addEventListener('click', async () => {
      const ok = await sheet(`<h2>Add device</h2><div class="grid g2 mt-md"><div class="field"><label>UID</label><input type="text" id="u"></div><div class="field"><label>Serial</label><input type="text" id="s"></div><div class="field"><label>MAC</label><input type="text" id="m"></div><div class="field"><label>Model</label><input type="text" id="mo"></div></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await AccountApp.api('POST', '/inventory', { uid: el.querySelector('#u').value, serial: el.querySelector('#s').value, mac: el.querySelector('#m').value, model: el.querySelector('#mo').value }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) AccountApp.route();
    });
  };
})();
