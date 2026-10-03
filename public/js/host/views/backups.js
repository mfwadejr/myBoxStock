// HOST / views / backups — schedule, create, download, restore, delete.
(() => {
  const { esc, fmt, toast, confirmBox, sheet, busy, swap } = UI;

  Host.views.backups = async (main) => {
    const d = await Host.api('GET', '/backups'), s = d.schedule;
    swap(main, `${Host.head('Backups', 'Snapshots of the platform database.')}
      ${d.engine !== 'sqlite' ? '<div class="banner mb-lg">You’re on an external database. Backups here use pg_dump / mysqldump and need those tools installed in the container; managed databases usually have their own snapshots too.</div>' : ''}
      <div class="card"><div class="row spread wrap"><div><h3>Automatic daily backup</h3><div class="setting-desc">Keeps the newest copies and removes older automatic ones.</div></div><label class="switch"><input type="checkbox" id="en" ${s.enabled ? 'checked' : ''}><i></i></label></div>
        <div class="row wrap mt-md items-end"><div><label>Hour (UTC)</label><input type="number" id="hr" min="0" max="23" value="${s.hourUtc}" class="w-xs"></div><div><label>Keep</label><input type="number" id="keep" min="1" max="365" value="${s.keep}" class="w-xs"></div><button class="btn secondary" id="save">Save</button></div></div>
      <div class="card"><div class="row spread"><h3>Backup files</h3><div class="row"><button class="btn secondary" id="full">Full-site backup</button><button class="btn" id="now">Back up now</button></div></div>
        <div class="tablewrap mt-sm">${d.backups.length ? `<table><thead><tr><th>File</th><th>Created</th><th>Size</th><th></th></tr></thead><tbody>${d.backups.map(b => `<tr><td class="mono">${esc(b.name)}</td><td class="muted">${fmt.date(b.created)}</td><td>${fmt.bytes(b.size)}</td>
        <td class="right nowrap"><a class="btn secondary small" href="/api/host/backups/${encodeURIComponent(b.name)}/download">Download</a> ${b.kind === 'fullsite' ? `<button class="btn secondary small" data-restore-full="${esc(b.name)}">Restore</button>` : ''}${b.kind === 'sqlite' ? `<button class="btn secondary small" data-restore="${esc(b.name)}">Restore</button>` : ''} <button class="btn danger small" data-del="${esc(b.name)}">Delete</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No backups yet.</div>'}</div></div>
      <div class="card"><h3>Full-site backup</h3><div class="sub">One file with the whole site: every account, user and setting, plus the encryption key that protects two-factor secrets. Protected by a passphrase you choose, which is not stored anywhere — keep it somewhere safe. Restore it on a new server with <span class="mono">node server.mjs restore-bundle</span> (see the README) and everyone can sign in as before. Plain backups above do not include the key.</div></div>`);
    main.querySelector('#save').addEventListener('click', async () => { await Host.api('PUT', '/backups/schedule', { enabled: main.querySelector('#en').checked, hourUtc: main.querySelector('#hr').value, keep: main.querySelector('#keep').value }); toast('Schedule saved'); });
    main.querySelector('#now').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await Host.api('POST', '/backups'); toast('Backup created'); Host.route(); } catch (er) { toast(er.message, true); } }));
    main.querySelector('#full').addEventListener('click', async () => {
      const ok = await sheet(`<h2>Full-site backup</h2><div class="field mt-md"><label>Backup passphrase</label><input type="password" id="pp" autocomplete="new-password"><div class="hint">At least 12 characters. You will need it to restore. It is not stored.</div></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Create backup</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await Host.api('POST', '/backups/bundle', { passphrase: el.querySelector('#pp').value }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) { toast('Full-site backup created'); Host.route(); }
    });
    main.querySelectorAll('[data-restore-full]').forEach(b => b.addEventListener('click', async () => {
      const ok = await sheet(`<h2>Restore full-site backup</h2><p class="sub">The current database is saved first, then replaced and the server restarts. Everyone is signed out.</p><div class="field"><label>Backup passphrase</label><input type="password" id="pp"></div><div class="field"><label>Type RESTORE to confirm</label><input type="text" id="cf" autocapitalize="characters"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="go">Restore</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await Host.api('POST', `/backups/${encodeURIComponent(b.dataset.restoreFull)}/restore-bundle`, { passphrase: el.querySelector('#pp').value, confirm: el.querySelector('#cf').value }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) { toast('Restoring… the console will reload'); setTimeout(() => location.reload(), 4500); }
    }));
    main.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => { if (await confirmBox({ title: 'Delete backup?', body: esc(b.dataset.del), confirmLabel: 'Delete', danger: true })) { await Host.api('DELETE', `/backups/${encodeURIComponent(b.dataset.del)}`); Host.route(); } }));
    main.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', async () => {
      const c = await confirmBox({ title: 'Restore this backup?', body: 'The current database is saved first, then replaced and the server restarts. Everyone is signed out.', confirmLabel: 'Restore', danger: true, typeToConfirm: 'RESTORE' });
      if (c) { try { await Host.api('POST', `/backups/${encodeURIComponent(b.dataset.restore)}/restore`, { confirm: 'RESTORE' }); toast('Restoring… the console will reload'); setTimeout(() => location.reload(), 4500); } catch (er) { toast(er.message, true); } }
    }));
  };
})();
