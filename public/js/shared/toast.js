// SHARED / toast — transient messages.
(() => {
  UI.toast = (msg, err = false) => {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.append(box); }
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; box.append(t);
    setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 320); }, err ? 4200 : 2400);
  };
})();
