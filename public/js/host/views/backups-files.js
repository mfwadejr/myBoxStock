// HOST / views / backups-files — the file lists on the Backups page, and the Restore and Test restore sheets.
(() => {
  const { esc, fmt, toast, sheet, confirmBox, busy } = UI;
  const B = Host.backups = Host.backups || {};
  const PAGE = 25;
  const KIND = { sqlite: 'Database snapshot', fullsite: 'Full-site backup', 'sql-dump': 'Database dump' };
  const LABEL = { snap: 'Snapshot', manual: 'By hand', auto: 'Nightly copy', daily: 'Nightly', weekly: 'Weekly', 'pre-restore': 'Before a restore', other: '' };

  // "3 hours 12 minutes", "2 days 4 hours": how long ago, for the Restore confirmation.
  B.ageText = (ms) => {
    const m = Math.max(0, Math.round(ms / 60000)); if (m < 1) return 'less than a minute';
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60, p = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    return d ? `${p(d, 'day')}${h ? ' ' + p(h, 'hour') : ''}` : h ? `${p(h, 'hour')}${mm ? ' ' + p(mm, 'minute') : ''}` : p(mm, 'minute');
  };

  // A capped, scrolling list: "Showing N of M", Load more. `load(offset)` returns { rows, total }. `row(r)` returns the table cells.
  B.fileList = (el, { load, heads, row, empty = 'Nothing here yet.', after }) => {
    let rows = [], total = 0, offset = 0;
    const paint = () => {
      el.innerHTML = rows.length ? `<div class="feed"><div class="tablewrap"><table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div></div>
        <div class="more-row"><span class="hint">Showing ${rows.length} of ${total}</span>${rows.length < total ? '<button class="btn secondary small" data-more>Load more</button>' : ''}</div>` : `<div class="empty">${esc(empty)}</div>`;
      el.querySelector('[data-more]')?.addEventListener('click', (e) => busy(e.currentTarget, () => more()));
      after?.(el, reload);
    };
    const more = async () => { const r = await load(offset); rows = rows.concat(r.rows); total = r.total; offset = rows.length; paint(); };
    const reload = async () => { rows = []; offset = 0; try { await more(); } catch (e) { el.innerHTML = `<div class="banner red">${esc(e.message)}</div>`; } };
    return reload();
  };

  // Rows for the local lists (snapshots, full-site, safety copies).
  B.localRow = (b, engine) => `<tr><td class="ident" data-label="">${esc(b.name)}</td><td class="tab-num" data-label="Taken">${esc(fmt.date(b.takenAt))}</td><td class="muted" data-label="Kind">${esc(LABEL[b.label] || KIND[b.kind] || '')}</td><td class="tab-num" data-label="Size">${fmt.bytes(b.size)}</td>
    <td class="right nowrap" data-label=""><a class="btn secondary small" href="/api/host/backups/${encodeURIComponent(b.name)}/download">Download</a> ${engine === 'sqlite' && b.kind !== 'sql-dump' ? `<button class="btn secondary small" data-restore="${esc(b.name)}">Restore</button>` : ''}<button class="btn secondary small" data-test="${esc(b.name)}">Test restore</button> <button class="btn danger small" data-del="${esc(b.name)}">Delete</button></td></tr>`;
  B.localHeads = ['File', 'Taken', 'Kind', 'Size', ''];
  B.localList = (el, tier, engine, onChange) => B.fileList(el, {
    heads: B.localHeads, row: (b) => B.localRow(b, engine), empty: 'No backups in this list yet.',
    load: (off) => Host.api('GET', `/backups/files?tier=${tier}&offset=${off}&limit=${PAGE}`),
    after: (box, reload) => B.wireRows(box, reload, onChange),
  });
  B.wireRows = (box, reload, onChange) => {
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!await confirmBox({ title: 'Delete this backup?', body: `<span class="ident">${esc(b.dataset.del)}</span> will be removed from this server. This cannot be undone.`, confirmLabel: 'Delete', danger: true })) return;
      try { await Host.api('DELETE', `/backups/${encodeURIComponent(b.dataset.del)}`); toast('Backup deleted'); await reload(); onChange?.(); } catch (e) { toast(e.message, true); }
    }));
    box.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => B.restoreSheet(b.dataset.restore)));
    box.querySelectorAll('[data-test]').forEach(b => b.addEventListener('click', () => B.testSheet(b.dataset.test)));
  };

  // The Restore confirmation: exactly which file, when it was taken, how much will be lost, and what happens next.
  B.restoreSheet = async (name) => {
    let info; try { info = await Host.api('GET', `/backups/${encodeURIComponent(name)}/restore-info`); } catch (e) { return toast(e.message, true); }
    if (!info.canRestore) return sheet(`<h2>Restore</h2><p class="muted">${esc(info.reason)}</p><div class="actions"><button class="btn" data-cancel>OK</button></div>`);
    const full = info.needsPassphrase;
    const ok = await sheet(`<h2>Restore this backup?</h2>
      <div class="banner red">Everyone goes back to this backup. Anything entered after it was taken will be lost.</div>
      <div class="setting"><div><div class="setting-title">File</div></div><div class="ident">${esc(info.name)}</div></div>
      <div class="setting"><div><div class="setting-title">Taken</div></div><div class="tab-num">${esc(info.takenAtText)} (${esc(fmt.date(info.takenAt))} your time)</div></div>
      <div class="setting"><div><div class="setting-title">That was</div></div><div>${esc(B.ageText(info.agoMs))} ago</div></div>
      <ul class="hint"><li>A safety copy of the site as it is now is taken first.</li><li>The site restarts and everyone is signed out.</li><li>A notice is shown to every customer afterwards: the site was restored from this backup and recent entries may be missing.</li></ul>
      ${full ? '<div class="field mt-md"><label>Backup passphrase</label><input type="password" id="pp" autocomplete="off"></div>' : ''}
      <div class="field mt-md"><label>Type RESTORE to confirm</label><input type="text" id="cf" autocomplete="off" autocapitalize="characters"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="go" disabled>Restore</button></div>`,
    { onMount: (el, close) => {
      const go = el.querySelector('#go'), cf = el.querySelector('#cf'); cf.addEventListener('input', () => { go.disabled = cf.value !== 'RESTORE'; });
      go.addEventListener('click', () => busy(go, async () => { try { await Host.api('POST', `/backups/${encodeURIComponent(name)}/${full ? 'restore-bundle' : 'restore'}`, { confirm: 'RESTORE', passphrase: el.querySelector('#pp')?.value || '' }); close(true); } catch (e) { toast(e.message, true); } }));
    } });
    if (ok) { toast('Restoring… the console will reload'); setTimeout(() => location.reload(), 4500); }
  };

  // Test restore: opens the backup in a scratch copy and shows what it found.
  B.testSheet = (name) => sheet(`<h2>Test restore</h2><p class="muted"><span class="ident">${esc(name)}</span></p><div id="tbody"><p class="hint">Opens a scratch copy of this backup, checks it, and deletes the copy. The live site is not touched.</p>
      ${name.endsWith('.mbsbak') ? '<div class="field"><label>Backup passphrase</label><input type="password" id="pp" autocomplete="off" placeholder="Leave blank to use the saved passphrase"></div>' : ''}</div>
      <div class="actions"><button class="btn secondary" data-cancel>Close</button><button class="btn" id="go">Run test</button></div>`, {
    onMount: (el) => {
      const go = el.querySelector('#go'), body = el.querySelector('#tbody');
      go.addEventListener('click', () => busy(go, async () => {
        body.innerHTML = '<p class="hint">Checking…</p>';
        try {
          const r = await Host.api('POST', `/backups/${encodeURIComponent(name)}/test-restore`, { passphrase: el.querySelector('#pp')?.value || '' });
          body.innerHTML = `<div class="banner ${r.ok ? 'blue' : 'red'}">${esc(r.summary)}</div>${r.checks.map(c => `<div class="setting"><div><div class="setting-title">${esc(c.label)}</div>${c.detail ? `<div class="setting-desc">${esc(c.detail)}</div>` : ''}</div><span class="chip ${c.ok ? 'green' : 'red'}">${c.ok ? 'Passed' : 'Failed'}</span></div>`).join('')}${r.note ? `<p class="hint">${esc(r.note)}</p>` : ''}`;
        } catch (e) { body.innerHTML = `<div class="banner red">${esc(e.message)}</div>`; }
      }));
    },
  });

  // Rows for copies held at a destination.
  B.remoteRow = (r) => `<tr><td class="ident" data-label="">${esc(r.name)}</td><td class="tab-num" data-label="Taken">${esc(fmt.date(r.takenAt))}</td><td class="muted" data-label="Where">${esc(r.destinationName)}</td><td class="tab-num" data-label="Size">${fmt.bytes(r.size)}</td>
    <td class="right nowrap" data-label=""><a class="btn secondary small" href="/api/host/backups/destinations/${encodeURIComponent(r.destination)}/files/${encodeURIComponent(r.name)}/download">Download</a> <button class="btn danger small" data-rdel="${esc(r.destination)}|${esc(r.name)}">Delete</button></td></tr>`;
  B.remoteList = (el, onChange) => B.fileList(el, {
    heads: ['File', 'Taken', 'Where', 'Size', ''], row: B.remoteRow, empty: 'No copies have been sent away yet.',
    load: async (off) => { const r = await Host.api('GET', `/backups/offsite?offset=${off}&limit=${PAGE}`); if (r.problems?.length && !off) toast(`${r.problems[0].destination}: ${r.problems[0].error}`, true); return r; },
    after: (box, reload) => box.querySelectorAll('[data-rdel]').forEach(b => b.addEventListener('click', async () => {
      const [dest, name] = b.dataset.rdel.split('|');
      if (!await confirmBox({ title: 'Delete this copy?', body: `<span class="ident">${esc(name)}</span> will be removed from the destination. This cannot be undone.`, confirmLabel: 'Delete', danger: true })) return;
      try { await Host.api('DELETE', `/backups/destinations/${encodeURIComponent(dest)}/files/${encodeURIComponent(name)}`); toast('Copy deleted'); await reload(); onChange?.(); } catch (e) { toast(e.message, true); }
    })),
  });
})();
