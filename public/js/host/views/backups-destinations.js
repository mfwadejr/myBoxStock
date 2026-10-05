// HOST / views / backups-destinations — the Destinations tab: where backups are sent, with a Test connection button for each.
(() => {
  const { esc, fmt, toast, sheet, confirmBox, busy } = UI;
  const B = Host.backups = Host.backups || {};
  // Fields per type: [key, label, kind, hint]. kind: text | password | number | check | area | secret (blank keeps the saved one)
  const FIELDS = {
    folder: [['path', 'Folder path', 'text', 'A full path, for example /backups. A NAS mounted through Docker works here too (see docker-compose.yml).']],
    smb: [['host', 'Server', 'text', 'Name or address, for example nas.local'], ['share', 'Share name', 'text', ''], ['folder', 'Folder on the share (optional)', 'text', 'For example backups/myboxstock'], ['username', 'User name', 'text', ''], ['domain', 'Domain (optional)', 'text', ''], ['password', 'Password', 'secret', '']],
    s3: [['endpoint', 'Endpoint', 'text', 'Leave blank for Amazon S3. Backblaze B2: https://s3.us-west-004.backblazeb2.com'], ['region', 'Region', 'text', 'For example us-east-1'], ['bucket', 'Bucket', 'text', ''], ['prefix', 'Folder prefix (optional)', 'text', 'For example myboxstock'], ['accessKey', 'Access key', 'text', ''], ['secretKey', 'Secret key', 'secret', ''], ['pathStyle', 'Use path-style addresses (MinIO and some others)', 'check', '']],
    sftp: [['host', 'Server', 'text', ''], ['port', 'Port', 'number', ''], ['username', 'User name', 'text', ''], ['folder', 'Folder', 'text', 'For example backups'], ['password', 'Password', 'secret', 'Or use a private key below.'], ['privateKey', 'Private key (optional)', 'area', 'Paste the key text. Saved sealed.'], ['keyPassphrase', 'Key passphrase (optional)', 'secret', '']],
    webdav: [['url', 'WebDAV address', 'text', 'For example https://cloud.example.com/remote.php/dav/files/me'], ['username', 'User name', 'text', ''], ['folder', 'Folder (optional)', 'text', 'For example backups'], ['password', 'Password', 'secret', '']],
  };
  const TYPE_OPTIONS = [['folder', 'Folder or mounted NAS'], ['smb', 'Windows / NAS share (SMB)'], ['s3', 'S3-compatible storage'], ['sftp', 'SFTP (SSH) server'], ['webdav', 'WebDAV']];

  const fieldHtml = (type, d) => FIELDS[type].map(([k, label, kind, hint]) => {
    const v = d?.settings?.[k] ?? '', saved = d?.secrets?.[k] === 'saved';
    if (kind === 'check') return `<label class="check"><input type="checkbox" data-f="${k}" ${v ? 'checked' : ''}> ${esc(label)}</label>`;
    const input = kind === 'area' ? `<textarea data-f="${k}" rows="4" autocomplete="off" placeholder="${saved ? 'Saved — leave blank to keep it' : ''}"></textarea>`
      : `<input data-f="${k}" type="${kind === 'secret' ? 'password' : kind === 'number' ? 'number' : 'text'}" autocomplete="${kind === 'secret' ? 'new-password' : 'off'}" value="${kind === 'secret' || kind === 'area' ? '' : esc(v)}" ${kind === 'secret' ? `placeholder="${saved ? 'Saved — leave blank to keep it' : ''}"` : ''}>`;
    return `<div class="field"><label>${esc(label)}</label>${input}${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
  }).join('');
  const gather = (el, type) => { const settings = {}, secrets = {}; for (const [k, , kind] of FIELDS[type]) { const i = el.querySelector(`[data-f="${k}"]`); if (kind === 'secret' || kind === 'area') { if (i.value) secrets[k] = i.value; } else settings[k] = kind === 'check' ? i.checked : i.value; } return { settings, secrets }; };

  B.destinationSheet = async (cur, onDone) => {
    let type = cur?.type || 'folder';
    const ok = await sheet(`<h2>${cur ? 'Edit destination' : 'Add a destination'}</h2>
      <div class="field"><label>Name</label><input type="text" id="dn" value="${esc(cur?.name || '')}" autocomplete="off" placeholder="For example Office NAS"></div>
      ${cur ? '' : `<div class="field"><label>Type</label>${UI.select.html({ id: 'dt', options: TYPE_OPTIONS, value: type })}</div>`}
      <div id="df">${fieldHtml(type, cur)}</div>
      <div class="setting"><div><div class="setting-title">Use this destination</div><div class="setting-desc">Everything sent here is encrypted first with your backup passphrase.</div></div><label class="switch"><input type="checkbox" id="den" ${cur ? (cur.enabled ? 'checked' : '') : 'checked'}><i></i></label></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div>`, {
      onMount: (el, close) => {
        el.querySelector('#dt')?.addEventListener('change', () => { type = UI.select.value(el.querySelector('#dt')); el.querySelector('#df').innerHTML = fieldHtml(type, null); });
        el.querySelector('#go').addEventListener('click', (e) => busy(e.currentTarget, async () => {
          try { const body = { type, name: el.querySelector('#dn').value, enabled: el.querySelector('#den').checked, ...gather(el, type) }; await Host.api(cur ? 'PUT' : 'POST', `/backups/destinations${cur ? '/' + cur.id : ''}`, body); close(true); } catch (er) { toast(er.message, true); }
        }));
      },
    });
    if (ok) { toast('Destination saved'); onDone(); }
  };

  const card = (d) => `<div class="card" data-id="${esc(d.id)}"><div class="row spread wrap"><div><h3>${esc(d.name)} <span class="chip">${esc(d.typeLabel)}</span>${d.builtin ? ' <span class="chip blue">Built in</span>' : ''}</h3>
      <div class="setting-desc">${d.type === 'folder' ? `<span class="ident">${esc(d.settings.path)}</span>` : esc(d.settings.host || d.settings.url || d.settings.bucket || '')}${d.type === 'sftp' && d.hostKey ? `<br>Server identity pinned: <span class="ident">${esc(d.hostKey)}</span>` : ''}</div>
      <div class="hint">${d.builtin ? 'The default location, inside the data folder you already mount. Files here are plain database files (see the note on the Frequent snapshots tab).' : d.encrypted ? 'Files are encrypted with your backup passphrase before they are sent.' : ''}${d.lastTest ? ` Last test: ${d.lastTest.ok ? 'worked' : 'failed'} ${esc(fmt.ago(d.lastTest.at))}.` : ''}</div></div>
      ${d.builtin ? '' : `<label class="switch"><input type="checkbox" data-en ${d.enabled ? 'checked' : ''}><i></i></label>`}</div>
      <div class="row wrap mt-md"><button class="btn secondary small" data-test>Test connection</button>${d.builtin ? '<button class="btn secondary small" data-folder>Change folder</button>' : '<button class="btn secondary small" data-edit>Edit</button><button class="btn danger small" data-del>Delete</button>'}</div><div class="mt-sm" data-result></div></div>`;

  B.destinationsPane = (pane, d, refresh) => {
    pane.innerHTML = `<div class="card"><div class="row spread wrap"><div><h3>Destinations</h3><div class="setting-desc">Places backups can be sent: a folder or mounted NAS, a Windows/NAS share, S3-compatible storage (Backblaze B2, Wasabi, Cloudflare R2, Amazon S3, MinIO), an SFTP server or WebDAV. Choose where each kind of backup goes on its own tab.</div></div><button class="btn" id="add">Add a destination</button></div></div>${d.destinations.map(card).join('')}`;
    pane.querySelector('#add').addEventListener('click', () => B.destinationSheet(null, refresh));
    pane.querySelectorAll('.card[data-id]').forEach(c => {
      const dest = d.destinations.find(x => x.id === c.dataset.id), res = c.querySelector('[data-result]');
      c.querySelector('[data-test]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
        res.innerHTML = '<span class="hint">Testing…</span>';
        try { const r = await Host.api('POST', `/backups/destinations/${encodeURIComponent(dest.id)}/test`); res.innerHTML = `<div class="banner ${r.ok ? 'blue' : 'red'}">${esc(r.message)}</div>`; if (r.ok && r.fingerprint && !dest.hostKey && dest.type === 'sftp') refresh(); } catch (er) { res.innerHTML = `<div class="banner red">${esc(er.message)}</div>`; }
      }));
      c.querySelector('[data-folder]')?.addEventListener('click', async () => {
        const v = await sheet(`<h2>Backup folder on this server</h2><div class="field mt-md"><label>Folder path</label><input type="text" id="lf" value="${esc(d.localDir === d.defaultDir ? '' : d.localDir)}" placeholder="${esc(d.defaultDir)}" autocomplete="off"><div class="hint">Leave blank for the default, ${esc(d.defaultDir)}, which is inside the data folder you already mount. Older backups stay where they are and are still listed.</div></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div>`,
          { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await Host.api('PUT', '/backups/tiers', { localDir: el.querySelector('#lf').value }); close(true); } catch (er) { toast(er.message, true); } }) });
        if (v) { toast('Backup folder saved'); refresh(); }
      });
      c.querySelector('[data-edit]')?.addEventListener('click', () => B.destinationSheet(dest, refresh));
      c.querySelector('[data-en]')?.addEventListener('change', async (e) => { try { await Host.api('PUT', `/backups/destinations/${encodeURIComponent(dest.id)}`, { name: dest.name, enabled: e.target.checked, settings: dest.settings, secrets: {} }); toast(e.target.checked ? 'Destination on' : 'Destination off'); refresh(); } catch (er) { e.target.checked = !e.target.checked; toast(er.message, true); } });
      c.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!await confirmBox({ title: 'Remove this destination?', body: `Backups will no longer be sent to ${esc(dest.name)}. Files already there are left in place.`, confirmLabel: 'Remove', danger: true })) return;
        try { await Host.api('DELETE', `/backups/destinations/${encodeURIComponent(dest.id)}`); toast('Destination removed'); refresh(); } catch (er) { toast(er.message, true); }
      });
    });
  };
})();
