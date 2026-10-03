// HOST / views / settings — site name, open sign-ups, how to change the database engine.
(() => {
  const { esc, toast, swap } = UI;

  Host.views.settings = async (main) => {
    const d = await Host.api('GET', '/settings');
    swap(main, `${Host.head('Settings', 'Platform-wide options.')}
      <div class="card"><div class="field"><label>Site name</label><input type="text" id="sn" value="${esc(d.siteName)}" class="maxw-lg"></div>
        <div class="setting"><div><div class="setting-title">Open sign-ups</div><div class="setting-desc">Allow new businesses to create an account.</div></div><label class="switch"><input type="checkbox" id="su" ${d.signupsEnabled ? 'checked' : ''}><i></i></label></div>
        <button class="btn mt-sm" id="save">Save</button></div>
      <div class="card"><h3>Database engine</h3><div class="sub">Currently <b>${esc(d.database.client)}</b>. SQLite is ideal for testing; for many simultaneous distributors switch to PostgreSQL or MariaDB.</div>
        <div class="codeblock"># 1. Create an empty database, then copy everything across (the original is untouched)
node server.mjs migrate-db --to postgres://user:pass@db-host:5432/myboxstock

# 2. Point the app at it and restart
DB_CLIENT=postgres
DATABASE_URL=postgres://user:pass@db-host:5432/myboxstock</div></div>`);
    main.querySelector('#save').addEventListener('click', async () => { await Host.api('PUT', '/settings', { siteName: main.querySelector('#sn').value, signupsEnabled: main.querySelector('#su').checked }); toast('Saved'); });
  };
})();
