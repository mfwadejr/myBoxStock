// HOST / views / backups — schedule, create, download, restore, delete.
(() => {
  const { esc, fmt, toast, confirmBox, busy, swap } = UI;

  Host.views.backups = async (main) => {
    const d = await Host.api('GET', '/backups'), s = d.schedule;
    swap(main, `${Host.head('Backups', 'Snapshots of the platform database.')}
      ${d.engine !== 'sqlite' ? '<div class="banner mb-lg">You’re on an external database. Backups here use pg_dump / mysqldump and need those tools installed in the container; managed databases usually have their own snapshots too.</div>' : ''}
      <div class="card"><div class="row spread wrap"><div><h3>Automatic daily backup</h3><div class="setting-desc">Keeps the newest copies and removes older automatic ones.</div></div><label class="switch"><input type="checkbox" id="en" ${s.enabled ? 'checked' : ''}><i></i></label></div>
        <div class="row wrap mt-md items-end"><div><label>Hour (UTC)</label><input type="number" id="hr" min="0" max="23" value="${s.hourUtc}" class="w-xs"></div><div><label>Keep</label><input type="number" id="keep" min="1" max="365" value="${s.keep}" class="w-xs"></div><button class="btn secondary" id="save">Save</button></div></div>
      <div class="card"><div class="row spread"><h3>Backup files</h3><button class="btn" id="now">Back up now</button></div>
        <div class="tablewrap mt-sm">${d.backups.length ? `<table><thead><tr><th>File</th><th>Created</th><th>Size</th><th></th></tr></thead><tbody>${d.backups.map(b => `<tr><td class="mono">${esc(b.name)}</td><td class="muted">${fmt.date(b.created)}</td><td>${fmt.bytes(b.size)}</td>
        <td class="right nowrap"><a class="btn secondary small" href="/api/host/backups/${encodeURIComponent(b.name)}/download">Download</a> ${b.kind === 'sqlite' ? `<button class="btn secondary small" data-restore="${esc(b.name)}">Restore</button>` : ''} <button class="btn danger small" data-del="${esc(b.name)}">Delete</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No backups yet.</div>'}</div></div>
      <div class="card"><h3>Keep your encryption key too</h3><div class="sub">Two-factor secrets are encrypted with a key stored beside the database (<span class="mono">secret.key</span>, or the APP_SECRET variable). A backup without that key cannot decrypt them.</div></div>`);
    main.querySelector('#save').addEventListener('click', async () => { await Host.api('PUT', '/backups/schedule', { enabled: main.querySelector('#en').checked, hourUtc: main.querySelector('#hr').value, keep: main.querySelector('#keep').value }); toast('Schedule saved'); });
    main.querySelector('#now').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await Host.api('POST', '/backups'); toast('Backup created'); Host.route(); } catch (er) { toast(er.message, true); } }));
    main.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => { if (await confirmBox({ title: 'Delete backup?', body: esc(b.dataset.del), confirmLabel: 'Delete', danger: true })) { await Host.api('DELETE', `/backups/${encodeURIComponent(b.dataset.del)}`); Host.route(); } }));
    main.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', async () => {
      const c = await confirmBox({ title: 'Restore this backup?', body: 'The current database is saved first, then replaced and the server restarts. Everyone is signed out.', confirmLabel: 'Restore', danger: true, typeToConfirm: 'RESTORE' });
      if (c) { try { await Host.api('POST', `/backups/${encodeURIComponent(b.dataset.restore)}/restore`, { confirm: 'RESTORE' }); toast('Restoring… the console will reload'); setTimeout(() => location.reload(), 4500); } catch (er) { toast(er.message, true); } }
    }));
  };
})();
