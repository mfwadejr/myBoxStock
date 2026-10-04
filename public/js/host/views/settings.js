// HOST / views / settings — open sign-ups, trial length, sign-in history, how to change the database engine.
(() => {
  const { esc, toast, swap } = UI;

  const src = (o) => o.saved ? 'Saved here.' : 'Using the server default.';

  Host.views.settings = async (main) => {
    const d = await Host.api('GET', '/settings');
    swap(main, `${Host.head('Settings', 'Platform-wide options.')}
      <div class="card">
        <div class="setting"><div><div class="setting-title">Open sign-ups</div><div class="setting-desc">Allow new businesses to create an account.</div></div><label class="switch"><input type="checkbox" id="su" ${d.signupsEnabled ? 'checked' : ''}><i></i></label></div>
        <div class="field"><label>Free trial length for new sign-ups (days)</label><input type="number" id="td" min="1" max="365" value="${esc(d.trialDays)}" class="maxw-lg"><div class="hint">Applies to accounts created from now on. Existing accounts keep their own end date — change those per account under Accounts → Change plan.</div></div>
        <div class="field"><label>Site address (used for every link in an email)</label><input type="text" id="sa" value="${esc(d.site.saved)}" placeholder="https://app.example.com" class="maxw-lg" autocapitalize="none" spellcheck="false"><div class="hint">${d.site.fromEnv ? `Not set here, so the server setting PUBLIC_URL is used: <span class="mono">${esc(d.site.url)}</span>. ` : ''}The address people type to reach this site from anywhere, with https. Confirmation, password reset and welcome emails link to it.</div>${d.site.problem ? `<div class="banner mt-sm">${esc(d.site.problem)}</div>` : ''}${!d.site.saved && location.protocol === 'https:' && location.hostname.includes('.') && !/\.(local|lan|home|internal)$|^[\d.]+$/.test(location.hostname) ? `<button class="btn secondary small mt-sm" id="usehere" type="button">Use ${esc(location.origin)}</button>` : ''}</div>
        <div class="field"><label>Keep sign-in history (days)</label><input type="number" id="sh" min="7" max="730" value="${esc(d.signInHistoryDays)}" class="maxw-lg"><div class="hint">How long each account keeps its list of sign-ins (who, from which IP and device). Older entries are removed automatically.</div></div>
        <button class="btn mt-sm" id="save">Save</button></div>
      <div class="card"><h3>Server options</h3><div class="sub">These used to be container environment variables. A value saved here wins; "Back to server defaults" returns to whatever the container sets.</div>
        <div class="setting"><div><div class="setting-title">Secure cookies</div><div class="setting-desc">Only send sign-in cookies over https. Turn on once the site is served through https (it can only be turned on from an https page, so you cannot lock yourself out). ${src(d.runtime.secureCookies)}</div></div><label class="switch"><input type="checkbox" id="rsc" ${d.runtime.secureCookies.value ? 'checked' : ''}><i></i></label></div>
        <div class="setting"><div><div class="setting-title">Resellers' mail servers on private networks</div><div class="setting-desc">Resellers can send receipts from their own mail server. Normally only public servers are allowed, so a reseller cannot probe your internal network. Turn on only if a reseller legitimately uses a relay inside your own network. ${src(d.runtime.allowPrivateMail)}</div></div><label class="switch"><input type="checkbox" id="rpm" ${d.runtime.allowPrivateMail.value ? 'checked' : ''}><i></i></label></div>
        <div class="field"><label>Reverse proxy in front of the site</label>${UI.select.html({ id: 'rtp', options: [['', 'None (connect directly)'], ['1', '1 proxy'], ['2', '2 proxies'], ['3', '3 proxies']], value: /^\d$/.test(d.runtime.trustProxy.value) || d.runtime.trustProxy.value === '' ? d.runtime.trustProxy.value : '1' })}<div class="hint">How many proxies sit between the internet and this site (for example your own proxy). This is how the site learns visitors' real addresses for the firewall and sign-in history. ${src(d.runtime.trustProxy)}</div></div>
        <div class="field"><label>Log detail</label>${UI.select.html({ id: 'rll', options: [['debug', 'Debug (everything)'], ['info', 'Info (normal)'], ['warn', 'Warnings and errors'], ['error', 'Errors only']], value: d.runtime.logLevel.value })}<div class="hint">${src(d.runtime.logLevel)}</div></div>
        <div class="field"><label>Keep the activity log (days)</label><input type="number" id="rlr" min="7" max="730" value="${esc(d.runtime.logRetentionDays.value)}" class="maxw-lg"><div class="hint">${src(d.runtime.logRetentionDays)}</div></div>
        <div class="row"><button class="btn" id="rsave">Save server options</button><button class="btn secondary" id="rreset">Back to server defaults</button></div></div>
      <div class="card"><h3>Database engine</h3><div class="sub">Currently <b>${esc(d.database.client)}</b>. SQLite is ideal for testing; for many simultaneous distributors switch to PostgreSQL or MariaDB.</div>
        <div class="codeblock"># 1. Create an empty database, then copy everything across (the original is untouched)
node server.mjs migrate-db --to postgres://user:pass@db-host:5432/myboxstock

# 2. Point the app at it and restart
DB_CLIENT=postgres
DATABASE_URL=postgres://user:pass@db-host:5432/myboxstock</div></div>`);
    const rt = (body) => Host.api('PUT', '/settings', { runtime: body }).then(() => { toast('Saved'); Host.route(); }).catch((e) => toast(e.message, true));
    main.querySelector('#rsave').addEventListener('click', () => rt({ secureCookies: main.querySelector('#rsc').checked, allowPrivateMail: main.querySelector('#rpm').checked, trustProxy: UI.select.value(main.querySelector('#rtp')), logLevel: UI.select.value(main.querySelector('#rll')), logRetentionDays: Number(main.querySelector('#rlr').value) }));
    main.querySelector('#rreset').addEventListener('click', () => rt({ secureCookies: null, allowPrivateMail: null, trustProxy: null, logLevel: null, logRetentionDays: null }));
    main.querySelector('#usehere')?.addEventListener('click', () => { main.querySelector('#sa').value = location.origin; });
    main.querySelector('#save').addEventListener('click', async () => { await Host.api('PUT', '/settings', { signupsEnabled: main.querySelector('#su').checked, trialDays: Number(main.querySelector('#td').value), signInHistoryDays: Number(main.querySelector('#sh').value), siteUrl: main.querySelector('#sa').value }).then(() => { toast('Saved'); Host.route(); }).catch((e) => toast(e.message, true)); });
  };
})();
