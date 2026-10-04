// HOST / views / settings — open sign-ups, trial length, sign-in history, how to change the database engine.
(() => {
  const { esc, toast, swap } = UI;

  Host.views.settings = async (main) => {
    const d = await Host.api('GET', '/settings');
    swap(main, `${Host.head('Settings', 'Platform-wide options.')}
      <div class="card">
        <div class="setting"><div><div class="setting-title">Open sign-ups</div><div class="setting-desc">Allow new businesses to create an account.</div></div><label class="switch"><input type="checkbox" id="su" ${d.signupsEnabled ? 'checked' : ''}><i></i></label></div>
        <div class="field"><label>Free trial length for new sign-ups (days)</label><input type="number" id="td" min="1" max="365" value="${esc(d.trialDays)}" class="maxw-lg"><div class="hint">Applies to accounts created from now on. Existing accounts keep their own end date — change those per account under Accounts → Change plan.</div></div>
        <div class="field"><label>Site address (used for every link in an email)</label><input type="text" id="sa" value="${esc(d.site.saved)}" placeholder="https://app.example.com" class="maxw-lg" autocapitalize="none" spellcheck="false"><div class="hint">${d.site.fromEnv ? `Not set here, so the server setting PUBLIC_URL is used: <span class="mono">${esc(d.site.url)}</span>. ` : ''}The address people type to reach this site from anywhere, with https. Confirmation, password reset and welcome emails link to it.</div>${d.site.problem ? `<div class="banner mt-sm">${esc(d.site.problem)}</div>` : ''}</div>
        <div class="field"><label>Keep sign-in history (days)</label><input type="number" id="sh" min="7" max="730" value="${esc(d.signInHistoryDays)}" class="maxw-lg"><div class="hint">How long each account keeps its list of sign-ins (who, from which IP and device). Older entries are removed automatically.</div></div>
        <button class="btn mt-sm" id="save">Save</button></div>
      <div class="card"><h3>Database engine</h3><div class="sub">Currently <b>${esc(d.database.client)}</b>. SQLite is ideal for testing; for many simultaneous distributors switch to PostgreSQL or MariaDB.</div>
        <div class="codeblock"># 1. Create an empty database, then copy everything across (the original is untouched)
node server.mjs migrate-db --to postgres://user:pass@db-host:5432/myboxstock

# 2. Point the app at it and restart
DB_CLIENT=postgres
DATABASE_URL=postgres://user:pass@db-host:5432/myboxstock</div></div>`);
    main.querySelector('#save').addEventListener('click', async () => { await Host.api('PUT', '/settings', { signupsEnabled: main.querySelector('#su').checked, trialDays: Number(main.querySelector('#td').value), signInHistoryDays: Number(main.querySelector('#sh').value), siteUrl: main.querySelector('#sa').value }).then(() => { toast('Saved'); Host.route(); }).catch((e) => toast(e.message, true)); });
  };
})();
