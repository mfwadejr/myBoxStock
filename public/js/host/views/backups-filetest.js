// HOST / views / backups-filetest — the "Test a backup file" card (Full-site backups tab) and its sheet: upload a file or pick one in the server's backup folder,
// run the checks, read the report, and (after a pass) restore that exact file. Styling is the standard classes only. The report shows counts, never contents.
(() => {
  const { esc, fmt, toast, sheet, busy } = UI;
  const B = Host.backups = Host.backups || {};
  const PAGE = 25;
  const cap = (s) => String(s || '').replace(/^./, c => c.toUpperCase());
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const chips = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="chip">${esc(cap(k))} ${n}</span>`).join(' ') || '<span class="hint">None</span>';
  const checkRows = (checks) => checks.map(c => `<div class="setting"><div><div class="setting-title">${esc(c.label)}</div>${c.detail ? `<div class="setting-desc">${esc(c.detail)}</div>` : ''}</div><span class="chip ${c.ok ? 'green' : 'red'}">${c.ok ? 'Passed' : 'Failed'}</span></div>`).join('');
  B.checkRows = checkRows;
  const kv = (label, value) => `<div class="setting"><div><div class="setting-title">${esc(label)}</div></div><div class="tab-num">${value}</div></div>`;
  const STATE = { same: ['green', 'Same'], differs: ['amber', 'Counts differ'], 'only-file': ['blue', 'Only in the file'] };

  // A table that shows PAGE rows at a time inside the standard scrolling feed. rows: arrays; cell(row) returns the <td>s.
  const pager = (el, heads, rows, cell, empty) => {
    let shown = PAGE;
    const paint = () => {
      el.innerHTML = rows.length ? `<div class="feed"><div class="tablewrap"><table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, shown).map(cell).join('')}</tbody></table></div></div>
        <div class="more-row"><span class="hint">Showing ${Math.min(shown, rows.length)} of ${rows.length}</span>${shown < rows.length ? '<button class="btn secondary small" data-more>Load more</button>' : ''}</div>` : `<div class="empty">${esc(empty)}</div>`;
      el.querySelector('[data-more]')?.addEventListener('click', () => { shown += PAGE; paint(); });
    };
    paint();
  };

  // The whole report as HTML (counts only). Per-account paging is wired by wireReport afterwards.
  const reportHtml = (r) => {
    const d = r.details, p = r.report, c = p.compare, rec = p.records;
    const lostFirst = c.onlyLiveTotal ? `<div class="banner red mb-md" id="ft-lost"><b>${plural(c.onlyLiveTotal, 'account')} on the live site ${c.onlyLiveTotal === 1 ? 'is' : 'are'} not in this file.</b> A restore would lose ${c.onlyLiveTotal === 1 ? 'it' : 'them'}.</div>` : '';
    const rel = c.relation === 'older' ? `<div class="banner mb-md" id="ft-older">This file is older than the latest activity on the live site (its newest change is ${esc(fmt.date(c.fileNewest))}; the live site changed ${esc(fmt.date(c.liveNewest))}). A restore would lose what was entered since.</div>`
      : c.relation === 'newer' ? `<div class="banner blue mb-md" id="ft-older">This file is newer than the live site.</div>` : '';
    return `<h3 class="mt-xl">The file</h3>
      ${kv('Kind', esc(d.kind))}${kv('Taken', esc(fmt.date(d.takenAt)))}${kv('Size', esc(fmt.bytes(d.size)))}${kv('App version', d.appVersion ? esc(d.appVersion) : 'Not recorded in this kind of file')}${kv('Database version', `${d.migration} (this server: ${d.serverMigration})`)}${kv('Readable by this server', d.readable ? 'Yes' : 'No')}${kv('Fingerprint (SHA-256)', `<span class="ident">${esc(d.sha256.slice(0, 16))}</span>`)}
      ${d.demoLeftOut ? `<p class="hint" id="ft-demoleft">${plural(d.demoLeftOut, 'Demo mode account')} ${d.demoLeftOut === 1 ? 'was' : 'were'} left out of this file on purpose, so restoring it never brings demo data back.</p>` : ''}${p.demo?.inFile ? `<div class="banner blue mb-md" id="ft-demoin">This file holds ${plural(p.demo.inFile, 'Demo mode account')}. Restoring it brings ${p.demo.inFile === 1 ? 'it' : 'them'} back; Demo mode can remove ${p.demo.inFile === 1 ? 'it' : 'them'} again.</div>` : ''}
      <h3 class="mt-xl">Compared with the live site</h3>${lostFirst}${rel}
      <div class="compare"><span></span><b>In the file</b><b>On the live site now</b>
        <span>Accounts</span><span class="tab-num">${p.accounts.total}</span><span class="tab-num">${p.live.accounts}</span>
        <span>Users</span><span class="tab-num">${p.users.total}</span><span class="tab-num">${p.live.users}</span>
        <span>Devices</span><span class="tab-num">${rec.file.devices}</span><span class="tab-num">${rec.live.devices}</span>
        <span>Customers</span><span class="tab-num">${rec.file.customers}</span><span class="tab-num">${rec.live.customers}</span>
        <span>Sales</span><span class="tab-num">${rec.file.sales}</span><span class="tab-num">${rec.live.sales}</span>
        ${p.kinds ? `<span>Models (reorder levels)</span><span class="tab-num">${p.kinds.file.models}</span><span class="tab-num">${p.kinds.live.models}</span><span>Settings records</span><span class="tab-num">${p.kinds.file.settings}</span><span class="tab-num">${p.kinds.live.settings}</span>` : ''}
        ${rec.file.other || rec.live.other ? `<span>Other records</span><span class="tab-num">${rec.file.other}</span><span class="tab-num">${rec.live.other}</span>` : ''}</div>
      ${c.onlyLiveTotal ? `<h3 class="mt-lg">Only on the live site (a restore would lose these)</h3><div id="ft-onlylive"></div>` : ''}
      ${c.onlyFileTotal ? `<p class="hint" id="ft-onlyfile">${plural(c.onlyFileTotal, 'account')} only in the file${c.onlyFileTotal > c.onlyFile.length ? `, first ${c.onlyFile.length} shown` : ''}: ${esc(c.onlyFile.slice(0, 20).join(', '))}${c.onlyFile.length > 20 ? '…' : ''}</p>` : ''}
      ${c.differTotal ? `<h3 class="mt-lg">Accounts whose record counts differ</h3><div id="ft-differ"></div>` : ''}
      <h3 class="mt-xl">Inside the file</h3>
      <div class="setting"><div><div class="setting-title">Accounts by plan</div></div><div class="row wrap" id="ft-plans">${chips(p.accounts.byPlan)}</div></div>
      <div class="setting"><div><div class="setting-title">Accounts by status</div></div><div class="row wrap" id="ft-status">${chips(p.accounts.byStatus)}</div></div>
      <div class="setting"><div><div class="setting-title">Users by role</div></div><div class="row wrap" id="ft-roles">${chips(p.users.byRole)}</div></div>
      <h3 class="mt-xl">Every account in the file</h3>
      <div class="field"><label for="ft-q">Find a Reseller ID</label><input type="search" id="ft-q" autocomplete="off"></div>
      <div id="ft-accts"></div>
      <p class="hint mt-md" id="ft-note">${esc(r.note)}</p>`;
  };
  const wireReport = (el, r) => {
    const p = r.report, c = p.compare;
    if (c.onlyLiveTotal) pager(el.querySelector('#ft-onlylive'), ['Reseller ID', 'Plan', 'Status', 'Devices', 'Customers', 'Sales'], c.onlyLive, (a) => `<tr><td class="ident nowrap" data-label="">${esc(a.code)}</td><td data-label="Plan">${esc(cap(a.plan))}</td><td data-label="Status">${esc(cap(a.status))}</td><td class="tab-num" data-label="Devices">${a.devices}</td><td class="tab-num" data-label="Customers">${a.customers}</td><td class="tab-num" data-label="Sales">${a.sales}</td></tr>`, '');
    if (c.differTotal) pager(el.querySelector('#ft-differ'), ['Reseller ID', 'In the file (devices / customers / sales)', 'Live now (devices / customers / sales)'], c.differ, (a) => `<tr><td class="ident nowrap" data-label="">${esc(a.code)}</td><td class="tab-num" data-label="In the file">${a.file.devices} / ${a.file.customers} / ${a.file.sales}</td><td class="tab-num" data-label="Live now">${a.live.devices} / ${a.live.customers} / ${a.live.sales}</td></tr>`, '');
    const box = el.querySelector('#ft-accts'), q = el.querySelector('#ft-q');
    const draw = () => { const t = q.value.trim().toLowerCase(), rows = t ? p.rows.filter(x => String(x[0]).toLowerCase().includes(t)) : p.rows;
      pager(box, ['Reseller ID', 'Plan', 'Users', 'Devices', 'Customers', 'Sales', 'Against live'], rows, (x) => `<tr><td class="ident nowrap" data-label="">${esc(x[0])}</td><td data-label="Plan">${esc(cap(x[1]))}<span class="muted"> · ${esc(x[2])}</span></td><td class="tab-num" data-label="Users">${x[3]}</td><td class="tab-num" data-label="Devices">${x[4]}</td><td class="tab-num" data-label="Customers">${x[5]}</td><td class="tab-num" data-label="Sales">${x[6]}</td><td data-label="Against live"><span class="chip ${STATE[x[7]][0]}">${STATE[x[7]][1]}</span></td></tr>`, 'No account matches.'); };
    q.addEventListener('input', draw); draw();
  };

  // The sheet. `start` is { file } (to upload) or { folder: name }. Closing it throws away the upload and the test result.
  B.fileReportHtml = (r) => reportHtml(r); B.fileReportWire = (el, r) => wireReport(el, r);
  B.fileTestSheet = async (start, info) => {
    const label = start.file ? start.file.name : start.folder, enc = !/\.db$/.test(label);
    let source = start.folder ? { folder: start.folder } : null, token = null, upload = null, uploaded = null, h = null, rh = null;
    await sheet(`<h2>Test a backup file</h2><p class="muted"><span class="ident">${esc(label)}</span>${start.file ? `<br>${esc(fmt.bytes(start.file.size))}` : ''}</p>
      <div id="ft-up" ${start.file ? '' : 'hidden'}><p class="hint" id="ft-upt" role="status">Uploading…</p><div class="meter"><i id="ft-bar" data-pct="0"></i></div></div>
      ${enc ? '<div class="field mt-md"><label for="ft-pp">Backup passphrase</label><input type="password" id="ft-pp" autocomplete="off" placeholder="Leave blank to use the saved passphrase"><div class="hint">The passphrase the file was made with. It is not stored or logged.</div></div>' : ''}
      <div id="ft-out" class="mt-md"></div>
      ${info.sqlite ? `<div id="ft-rest" class="mt-lg" hidden><div class="banner red">Everyone goes back to this file. Anything entered after it was taken will be lost.</div>
        <ul class="hint"><li>A safety copy of the site as it is now is taken first, and kept on the Safety copies tab, so this restore can be undone.</li><li>The site closes while it restores, then restarts, and everyone is signed out. This console reloads.</li><li>A notice is shown to every customer afterwards: the site was restored from a backup and recent entries may be missing.</li></ul>
        <div class="field mt-md"><label for="ft-cf">Type RESTORE to confirm</label><input type="text" id="ft-cf" autocomplete="off" autocapitalize="characters"></div><p class="hint" id="ft-why"></p><div id="ft-rjob"></div></div>` : ''}
      <div class="actions"><button class="btn secondary" data-cancel>Close</button><button class="btn" id="ft-run" ${start.file ? 'disabled' : ''}>Run test</button>${info.sqlite ? '<button class="btn danger" id="ft-go" disabled hidden>Restore this file</button>' : ''}</div>`, {
      wide: true,
      onMount: (el, close) => {
        const run = el.querySelector('#ft-run'), out = el.querySelector('#ft-out'), go = el.querySelector('#ft-go'), cf = el.querySelector('#ft-cf'), why = el.querySelector('#ft-why'), rest = el.querySelector('#ft-rest'), bar = el.querySelector('#ft-bar'), upt = el.querySelector('#ft-upt');
        let passed = false, reason = 'Run the test first.';
        const sync = () => { if (!go) return; const typed = cf.value === 'RESTORE'; go.hidden = !passed; rest.hidden = !passed; go.disabled = !(passed && typed && !rh); why.textContent = passed ? (typed ? '' : 'Type RESTORE to turn the button on.') : `Restore is off: ${reason}`; };
        if (start.file) {
          upload = Host.api.upload(`/backups/file-test/upload?name=${encodeURIComponent(start.file.name)}`, start.file, (f) => { bar.dataset.pct = String(Math.round(f * 100)); UI.dynamic(el); upt.textContent = `Uploading… ${Math.round(f * 100)}%`; });
          upload.then((r) => { uploaded = r; source = { upload: r.id }; upt.textContent = `Uploaded ${fmt.bytes(r.size)}. Ready to test.`; run.disabled = false; }, (e) => { upt.textContent = ''; out.innerHTML = `<div class="banner red" role="alert">${esc(e.message)}</div>`; });
        }
        cf?.addEventListener('input', sync);
        // The test and the restore are background jobs: the bar and the step show here, and the status strip on the page keeps them if this sheet is closed.
        run.addEventListener('click', () => {
          if (!source) return; run.disabled = true; passed = false; token = null; reason = 'Testing the file…'; sync(); out.innerHTML = B.progressHtml();
          h = B.jobs.run('file-test', { source, passphrase: el.querySelector('#ft-pp')?.value || '' }, (j) => B.progressPaint(out, j));
          const shown = (html) => { out.innerHTML = html; run.disabled = false; sync(); };
          h.done.then((j) => {
            if (j.status === 'failed') { reason = j.error.message; return shown(`<div class="banner red" role="alert">${esc(j.error.message)}</div>`); }
            const r = j.result; passed = r.ok; token = r.token || null; reason = r.ok ? '' : r.summary;
            shown(`<div class="banner ${r.ok ? 'blue' : 'red'}" role="status" id="ft-sum">${esc(r.summary)}</div><div id="ft-checks">${checkRows(r.checks)}</div>${r.report ? reportHtml(r) : `<p class="hint mt-md" id="ft-note">${esc(r.note)}</p>`}`);
            if (r.report) wireReport(out, r);
          }, (e) => { reason = e.message; shown(`<div class="banner red" role="alert">${esc(e.message)}</div>`); });
        });
        go?.addEventListener('click', () => {
          go.disabled = true; why.textContent = ''; const rj = el.querySelector('#ft-rjob'); rj.innerHTML = B.progressHtml('ftp');
          rh = B.jobs.run('file-restore', { token, confirm: 'RESTORE', passphrase: el.querySelector('#ft-pp')?.value || '' }, (j) => B.progressPaint(rj, j));
          const back = (msg) => { rh = null; rj.innerHTML = `<div class="banner red" role="alert">${esc(msg)}</div>`; sync(); };
          rh.done.then((j) => { if (j.status === 'failed') return back(j.error.message); token = null; uploaded = null; close(true); }, (e) => back(e.message));
        });
        sync();
      },
    }).then(async (done) => {
      try { upload?.abort?.(); } catch {}
      h?.release(); rh?.release();
      if (token) { try { await Host.api('DELETE', `/backups/file-test/token/${token}`); } catch {} }
      if (uploaded) { try { await Host.api('DELETE', `/backups/file-test/upload/${uploaded.id}`); } catch {} }
    });
  };

  // The card. `pane` is the Full-site tab; it stays usable even while the tab's settings are locked, because a file from a lost server needs no setup.
  B.fileTestCard = async (pane) => {
    let info; try { info = await Host.api('GET', '/backups/file-test'); } catch (e) { return; }
    if (!pane.querySelector('#hand')) return; // the person moved to another tab while this loaded
    const card = document.createElement('div'); card.className = 'card'; card.id = 'ft-card'; card.dataset.open = '';
    card.innerHTML = `<h3>Test a backup file</h3><div class="setting-desc">Check a backup that is held somewhere else, for example a full-site backup downloaded to a laptop, or the file you would use to rebuild after losing this server. You enter its passphrase, it is opened in a scratch copy, and you see what is inside and how it compares with the live site. Nothing changes unless you then choose to restore it.</div>
      <div class="setting"><div><div class="setting-title">A file from this computer</div><div class="setting-desc">.mbsbak, .mbsenc or .db. Up to ${esc(fmt.bytes(info.limitBytes))}; it is sent straight to disk on the server, never held in memory.</div></div><button class="btn secondary" id="ft-pick">Choose file</button><input type="file" id="ft-file" accept=".mbsbak,.mbsenc,.db"></div>
      <div class="mt-lg"><div class="setting-title">A file already in the server\u2019s backup folder</div><div class="setting-desc">${info.folder.length ? `Files placed in <span class="ident">${esc(info.dir)}</span> by hand. No upload is needed.` : `Nothing to choose: no .mbsbak, .mbsenc or .db file placed by hand is in <span class="ident">${esc(info.dir)}</span>. Copy one there and reload this page.`}</div>
        ${info.folder.length ? `<div class="field mt-md">${UI.select.html({ id: 'ft-folder', options: info.folder.map(f => [f.name, `${f.name} (${fmt.bytes(f.size)})`]), value: info.folder[0].name })}</div><button class="btn secondary" id="ft-test-folder">Test this file</button>` : ''}</div>`;
    pane.append(card);
    const file = card.querySelector('#ft-file');
    card.querySelector('#ft-pick').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files[0]; file.value = ''; if (!f) return;
      if (f.size > info.limitBytes) return toast(`That file is ${fmt.bytes(f.size)}, more than the ${fmt.bytes(info.limitBytes)} this server accepts as an upload. Copy it into the server’s backup folder and test it from there.`, true);
      if (!/\.(mbsbak|mbsenc|db)$/.test(f.name)) return toast('Choose a myBoxStock backup file: .mbsbak, .mbsenc or .db.', true);
      B.fileTestSheet({ file: f }, info).then(() => B.reloadStrip?.());
    });
    card.querySelector('#ft-test-folder')?.addEventListener('click', () => B.fileTestSheet({ folder: UI.select.value(card.querySelector('#ft-folder')) }, info).then(() => B.reloadStrip?.()));
  };
})();
