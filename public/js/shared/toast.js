// SHARED / toast — transient messages, and polite announcements for screen readers.
// UI.toast(msg, err)   a message that fades after a few seconds. It is read out as a status (an error as an alert) and never takes focus.
// UI.announce(msg)     says something to screen readers only (a count changed, a job moved on) without showing anything or moving focus.
(() => {
  // The two live regions are placed in the page once, empty, so that text added later is read out (a region created together with its text is often skipped).
  const region = (key, cls, role, live) => {
    let box = document.querySelector(`[data-live="${key}"]`);
    if (!box) { box = document.createElement('div'); box.className = cls; box.dataset.live = key; box.setAttribute('role', role); box.setAttribute('aria-live', live); box.setAttribute('aria-atomic', 'true'); document.body.append(box); }
    return box;
  };
  const toasts = () => region('toasts', 'toasts', 'status', 'polite');
  const talk = () => region('talk', 'sr-only', 'status', 'polite');
  let last = '', lastAt = 0;
  UI.announce = (msg) => {
    const box = talk(), now = Date.now();
    if (msg === last && now - lastAt < 1500) return;   // the same words twice in a row would only be noise
    last = msg; lastAt = now; box.textContent = ''; setTimeout(() => { box.textContent = msg; }, 30);
  };
  UI.toast = (msg, err = false) => {
    const box = toasts();
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; if (err) t.setAttribute('role', 'alert'); box.append(t);
    setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 320); }, err ? 4200 : 2400);
  };
  toasts(); talk();
})();
