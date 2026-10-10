// SHARED / totp-setup — two-factor enrollment flow (QR + code + recovery codes). `api` is the realm's client.
(() => {
  const { esc } = UI;
  UI.totpSetup = async (api) => {
    const s = await api('POST', '/totp/setup');
    const codes = await UI.sheet(`<h2>Set up two-factor</h2><p class="muted">Scan with an authenticator app (1Password, Google Authenticator, Authy…), then enter the 6-digit code.</p>
      <div class="qr qr-center">${UI.qrSvg(s.uri)}</div>
      <p class="faint text-xs center">Can’t scan? Enter this key: <span class="ident">${esc(s.secret)}</span></p>
      <div class="field mt-md"><input type="text" class="codeinput" id="code" aria-label="Six-digit code from your app" inputmode="numeric" maxlength="7" placeholder="000000" autocomplete="one-time-code"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Turn on</button></div>`,
      { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => {
        try { close((await api('POST', '/totp/enable', { code: el.querySelector('#code').value })).recoveryCodes); } catch (e) { UI.toast(e.message, true); } }) });
    if (!codes) return false;
    await UI.sheet(`<h2>Save your recovery codes</h2><p class="muted">Each code works once if you lose your device. Store them somewhere safe — they won’t be shown again.</p>
      <div class="recovery mt-lg">${codes.map(c => `<span>${esc(c)}</span>`).join('')}</div><div class="actions"><button class="btn" data-cancel>I’ve saved them</button></div>`);
    return true;
  };
})();
