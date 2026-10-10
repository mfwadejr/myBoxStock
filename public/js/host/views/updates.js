// HOST / views / updates — the version that is running, what the last update did, and whether a newer release exists.
(() => {
  const { esc, fmt, toast, busy, swap } = UI;
  Host.views.updates = async (main) => {
    const paint = (s) => {
      const c = s.check, u = s.lastUpdate;
      swap(main, `${Host.head('Updates', 'This server never updates itself. To update, rebuild the container from the new version; this page shows what is running and what the last update did.')}
        <div class="grid g3"><div class="card stat"><div class="stat-label">Running version</div><div class="stat-value">${esc(s.version)}</div><div class="stat-note">${s.build ? `build ${esc(s.build)} · ` : ''}started ${esc(fmt.ago(s.startedAt))}</div></div>
          <div class="card stat"><div class="stat-label">Newest release</div><div class="stat-value">${c.latest ? esc(c.latest) : '—'}</div><div class="stat-note">${!c.configured ? 'not checking' : c.error ? esc(c.error) : c.newer ? 'a newer version is available' : c.latest ? 'you are up to date' : 'not checked yet'}</div></div>
          <div class="card stat"><div class="stat-label">Last update</div><div class="stat-value small">${u ? `${esc(u.from)} to ${esc(u.to)}` : 'none seen'}</div><div class="stat-note">${u ? `${esc(fmt.ago(u.at))} · ${u.clean && !s.errorsSinceStart ? 'clean' : 'check the logs'}${u.migrations.length ? ` · ${u.migrations.length} database change${u.migrations.length === 1 ? '' : 's'}` : ''}` : 'shown after the first update'}</div></div></div>
        ${c.newer ? `<div class="banner blue mt-lg">Version ${esc(c.latest)} is available. Take a backup first (Backups), then rebuild the container.${c.notes ? ` <a href="${esc(c.notes)}" target="_blank" rel="noopener">What changed</a>` : ''}</div>` : ''}
        <div class="card mt-lg"><h3>Health since start</h3><div class="sub">Unexpected errors recorded since this version started.</div><span class="chip ${s.errorsSinceStart ? 'red' : 'green'}">${s.errorsSinceStart} error${s.errorsSinceStart === 1 ? '' : 's'}</span>${s.errorsSinceStart ? ' <a href="#/logs?area=error&range=7d">Open the error log</a>' : ''}</div>
        <div class="card"><h3>Release address</h3><div class="sub">Optional. The address of your release feed (for GitHub: https://api.github.com/repos/OWNER/REPO/releases/latest). The server asks once a day for the version label only.</div>
          <div class="row wrap"><input type="text" id="url" class="grow" aria-label="Update address" placeholder="https://" value="${esc(c.url)}"><button class="btn" id="save">Save</button><button class="btn secondary" id="chk" ${c.url ? '' : 'disabled'}>Check now</button></div>${c.checkedAt ? `<div class="hint">Last checked ${esc(fmt.ago(c.checkedAt))}.</div>` : ''}</div>`);
      main.querySelector('#save').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { paint(await Host.api('PUT', '/updates', { url: main.querySelector('#url').value })); toast('Saved'); } catch (er) { toast(er.message, true); } }));
      main.querySelector('#chk').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { paint(await Host.api('POST', '/updates/check')); toast('Checked'); } catch (er) { toast(er.message, true); } }));
    };
    paint(await Host.api('GET', '/updates'));
  };
})();
