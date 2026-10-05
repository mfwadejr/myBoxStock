// APP / scan-ui — the phone-camera scanner: a full-screen layer with a scan box, plus the camera button that sits inside scannable fields.
// Frames are cropped to the box, decoded on this device and thrown away. Nothing is uploaded, stored or logged.
(() => {
  const { esc, toast } = UI, A = AccountApp, Core = window.ScanCore, KEY = 'mbs.scanSize', SIZES = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
  const sizeGet = () => { try { const v = localStorage.getItem(KEY); return SIZES.some(s => s[0] === v) ? v : 'medium'; } catch { return 'medium'; } };
  const sizeSet = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private window: the choice is simply not remembered */ } };
  const val = (x) => typeof x === 'function' ? x() : x;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const WEAK = /code_39|itf|codabar|code39/i;   // these have no built-in check digit, so wait for one more matching frame

  // Plain-English reasons the camera could not start.
  const cameraProblem = (e) => {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'The camera is turned off for this site. Allow the camera when your browser asks (on an iPhone: Settings, Safari, Camera), then tap Try again. You can also type the code or take a photo.';
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'No camera was found on this device. You can type the code or take a photo of it instead.';
    if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return 'The camera is busy. Close any other app or browser tab that is using it, then tap Try again.';
    return 'The camera could not start. Tap Try again, or type the code or take a photo instead.';
  };
  const INSECURE = 'The camera only works when this site is opened over https (a secure web address). Open it with an address that starts with https://, or type the code or take a photo instead.';

  // steps: [{ label, mode: 'text' | 'mac', apply(value) -> '' | problem text, continuous }]. label and mode may be functions. Resolves { typed, count }.
  function run(steps, { engine } = {}) {
    return new Promise((resolve) => {
      const opener = document.activeElement;
      const layer = document.createElement('div');
      layer.className = 'scanner'; layer.tabIndex = -1; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true'); layer.setAttribute('aria-label', 'Scan a code'); layer.dataset.state = 'look';
      layer.innerHTML = `<video class="scan-video" playsinline muted autoplay></video>
        <div class="scan-top"><div class="scan-title"></div><button type="button" class="scan-btn" data-act="close">Close</button></div>
        <div class="scan-stage"><div class="scan-box ${sizeGet()}"><span class="scan-corner tl"></span><span class="scan-corner tr"></span><span class="scan-corner bl"></span><span class="scan-corner br"></span><span class="scan-aim"></span></div>
          <div class="scan-float"><div class="scan-got" hidden><div class="scan-value ident"></div><div class="scan-row"></div></div><div class="scan-choices" hidden></div></div></div>
        <div class="scan-panel">
          <p class="scan-hint" role="status" aria-live="polite"></p>
          <div class="scan-sizes" role="group" aria-label="Scan box size">${SIZES.map(([k, l]) => `<button type="button" class="scan-btn" data-size="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
          <div class="scan-row"><button type="button" class="scan-btn" data-act="flash" hidden>Flash</button><button type="button" class="scan-btn" data-act="retry" hidden>Try again</button><button type="button" class="scan-btn" data-act="type">Type it instead</button><button type="button" class="scan-btn" data-act="photo">${A.icons.camera}Take a photo</button></div>
        </div>
        <input type="file" class="scan-file" accept="image/*" capture="environment">`;
      document.body.append(layer);
      const q = (s) => layer.querySelector(s), box = q('.scan-box'), video = q('video'), hint = q('.scan-hint'), got = q('.scan-got'), choices = q('.scan-choices');
      const S = { i: 0, alive: true, paused: false, stream: null, track: null, lock: null, audio: null, count: 0, ignore: null, typed: false, torch: false, cons: Core.consensus(2), looping: false };
      const step = () => steps[S.i], mode = () => val(step().mode) || 'text', label = () => val(step().label) || 'a code';
      const setState = (st, text) => { layer.dataset.state = st; if (text != null) hint.textContent = text; };
      const lookText = () => `Fit the whole code in the box`;
      const title = () => { q('.scan-title').textContent = `Scan ${label()}`; };
      const showSizes = () => layer.querySelectorAll('[data-size]').forEach(b => { const on = box.classList.contains(b.dataset.size); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      const clearPanel = () => { got.hidden = true; choices.hidden = true; choices.innerHTML = ''; q('[data-act=retry]').hidden = true; };
      const look = () => { clearPanel(); S.cons.reset(); S.paused = false; title(); setState('look', lookText()); };

      // ---- feedback, wake lock, torch ----
      const beep = () => { try { const ac = S.audio; if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.09); } catch { /* sound is optional */ } };
      const buzz = () => { try { navigator.vibrate && navigator.vibrate(60); } catch { /* not every phone can */ } };
      const wake = async () => { try { if (navigator.wakeLock && !S.lock && S.alive) { S.lock = await navigator.wakeLock.request('screen'); S.lock.addEventListener?.('release', () => { S.lock = null; }); } } catch { S.lock = null; } };
      const onVis = () => { if (document.visibilityState === 'visible') wake(); };
      try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) S.audio = new AC(); } catch { S.audio = null; }

      // ---- closing: always stop the camera and release the screen ----
      const stopCamera = () => { try { S.stream?.getTracks().forEach(t => t.stop()); } catch { /* already stopped */ } S.stream = null; S.track = null; try { video.srcObject = null; } catch { /* gone */ } };
      const close = () => {
        if (!S.alive) return; S.alive = false; stopCamera();
        try { S.lock?.release(); } catch { /* released */ } S.lock = null; try { S.audio?.close(); } catch { /* closed */ }
        document.removeEventListener('keydown', onKey, true); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', close); window.removeEventListener('hashchange', close);
        layer.remove(); try { opener && opener.isConnected && opener.focus && !S.typed && opener.focus({ preventScroll: true }); } catch { /* nothing to focus */ }
        resolve({ typed: S.typed, count: S.count });
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
      document.addEventListener('keydown', onKey, true); document.addEventListener('visibilitychange', onVis); window.addEventListener('pagehide', close); window.addEventListener('hashchange', close);

      // ---- a value was read ----
      const finish = async (value) => {
        S.paused = true; clearPanel(); buzz(); beep(); setState('got', 'Got it'); q('.scan-value').textContent = value; got.hidden = false; q('.scan-got .scan-row').innerHTML = '';
        let bad = ''; try { bad = await step().apply(value) || ''; } catch (e) { bad = e.message || 'That could not be used.'; }
        if (!S.alive) return;
        if (bad) { S.ignore = value; setState('warn', bad); S.paused = false; S.cons.reset(); return; }
        S.count++; try { A.scanner.onScan && A.scanner.onScan(); } catch { /* an event hook must never break scanning */ }
        const cont = !!val(step().continuous), nxt = steps[S.i + 1];
        if (cont) { S.ignore = value; await sleep(900); if (S.alive) { got.hidden = true; look(); S.paused = false; } return; }
        if (nxt) {
          const row = q('.scan-got .scan-row'); row.innerHTML = `<button type="button" class="scan-btn primary" data-act="next">Scan ${esc(val(nxt.label) || 'the next one')}</button><button type="button" class="scan-btn" data-act="redo">Scan again</button><button type="button" class="scan-btn" data-act="close">Done</button>`;
          return;
        }
        toast(`Scanned ${value}`); await sleep(650); close();
      };

      // ---- choose between near-equal codes ----
      const offer = (list) => {
        S.paused = true; clearPanel(); setState('warn', 'Two codes are about equally close. Tap the one you want.');
        choices.innerHTML = list.map((c, n) => `<button type="button" class="scan-choice ident" data-pick="${n}">${esc(c.value)}</button>`).join('') + '<button type="button" class="scan-btn" data-act="redo">Scan again</button>';
        choices.hidden = false; choices._list = list;
      };

      // ---- the camera loop: crop to the box, decode, wait for the same answer in a few frames ----
      const canvas = document.createElement('canvas');
      const grab = (crop, scale) => { const cw = Math.max(8, Math.round(crop.w * scale)), ch = Math.max(8, Math.round(crop.h * scale)); canvas.width = cw; canvas.height = ch; const g = canvas.getContext('2d', { willReadFrequently: true }); g.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, cw, ch); return { cw, ch }; };
      const seen = async (dec, crop, scale, br, top = 0, part = 1) => { const { cw, ch } = grab(crop, scale); return (await dec.decode(canvas)).map(c => ({ ...c, x: c.x / cw * br.width, y: (c.y / ch * part + top) * br.height })); };
      let engineObj = null;
      const frame = async () => {
        const vr = video.getBoundingClientRect(), br = box.getBoundingClientRect(); if (!vr.width || !br.width || !video.videoWidth) return null;
        const crop = Core.cropRect({ w: vr.width, h: vr.height }, { w: video.videoWidth, h: video.videoHeight }, { x: br.left - vr.left, y: br.top - vr.top, w: br.width, h: br.height });
        const dims = { w: br.width, h: br.height };
        let cands = await seen(engineObj, crop, Math.min(1, 1600 / crop.w), br), r = Core.choose(cands, dims, mode());
        if (!r.pick || r.pick.d > 0.25 * Math.min(dims.w, dims.h) || r.tied.length) { const mid = { x: crop.x, y: crop.y + Math.round(crop.h * 0.2), w: crop.w, h: Math.max(8, Math.round(crop.h * 0.6)) }; cands = cands.concat(await seen(engineObj, mid, Math.min(2, 2400 / crop.w), br, 0.2, 0.6)); r = Core.choose(cands, dims, mode()); }   // dense bars: look again magnified
        return r;
      };
      const loop = async () => {
        if (S.looping) return; S.looping = true;
        try {
          engineObj = await A.scanDecode.create(A.scanner.engine || engine || 'auto'); layer.dataset.engine = engineObj.name;
          while (S.alive) {
            if (S.paused || video.readyState < 2) { await sleep(120); continue; }
            const t0 = performance.now(); let r = null; try { r = await frame(); } catch { r = null; }
            if (!S.alive) break;
            const c = r && (r.pick || r.tied.length) ? r : null;
            if (!c) { S.ignore = null; S.cons.push(null); }
            else if (c.pick && c.pick.value === S.ignore) { S.cons.push(null); }
            else { const key = c.pick ? c.pick.value : c.tied.map(t => t.value).sort().join('|'); if (S.cons.push(key, c.pick && WEAK.test(c.pick.format || '') ? 3 : 2)) { if (c.pick) await finish(c.pick.value); else offer(c.tied); } }
            await sleep(Math.max(30, 110 - (performance.now() - t0)));
          }
        } catch (e) { if (S.alive) problem(e.message || 'The scanner could not be loaded.'); } finally { S.looping = false; }
      };

      // ---- starting the camera ----
      const problem = (text) => { stopCamera(); S.paused = true; setState('warn', text); q('[data-act=retry]').hidden = false; q('[data-act=flash]').hidden = true; };
      const start = async () => {
        look(); q('[data-act=retry]').hidden = true;
        if (!window.isSecureContext) return problem(INSECURE);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return problem('This browser cannot use the camera here. You can type the code or take a photo instead.');
        try {
          try { S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }); }
          catch (e) { if (e && e.name === 'OverconstrainedError') S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true }); else throw e; }
        } catch (e) { return problem(cameraProblem(e)); }
        if (!S.alive) { stopCamera(); return; }
        S.track = S.stream.getVideoTracks()[0];
        try { const caps = S.track.getCapabilities ? S.track.getCapabilities() : {}; if (caps.focusMode && caps.focusMode.includes('continuous')) await S.track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); q('[data-act=flash]').hidden = !caps.torch; } catch { /* focus and flash are extras */ }
        video.srcObject = S.stream; try { await video.play(); } catch { /* autoplay is already on */ }
        wake(); S.paused = false; loop();
      };

      // ---- the photo fallback: the same decoder, on a picture instead of the camera ----
      const photo = async (file) => {
        S.paused = true; clearPanel(); setState('look', 'Reading the photo…');
        let bmp = null, url = null;
        try {
          if (window.createImageBitmap) bmp = await createImageBitmap(file); else { url = URL.createObjectURL(file); bmp = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; }); }
          const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, 1800 / Math.max(w0, h0)), c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          const dec = await A.scanDecode.create(A.scanner.engine || engine || 'auto'); let cands = await dec.decode(c), list = Core.ranked(cands, { w: c.width, h: c.height }, mode());
          if (!list.length) { const k2 = Math.min(2, 2600 / c.width), big = document.createElement('canvas'); big.width = Math.round(c.width * k2); big.height = Math.round(c.height * k2); big.getContext('2d').drawImage(c, 0, 0, big.width, big.height); cands = (await dec.decode(big)).map(r => ({ ...r, x: r.x / k2, y: r.y / k2 })); list = Core.ranked(cands, { w: c.width, h: c.height }, mode()); }
          if (!S.alive) return;
          if (!list.length) { S.paused = false; return setState('warn', mode() === 'mac' ? 'No MAC address was found in that photo. Move closer so the whole code fills the picture, and try again.' : 'No code was found in that photo. Move closer so the whole code fills the picture, and try again.'); }
          if (list.length === 1) return finish(list[0].value);
          offer(list.slice(0, 6)); setState('warn', 'Several codes were found. Tap the one you want.');
        } catch { if (S.alive) { S.paused = false; setState('warn', 'That photo could not be read. Try again.'); } }
        finally { if (url) URL.revokeObjectURL(url); try { bmp && bmp.close && bmp.close(); } catch { /* done */ } }
      };

      // ---- buttons ----
      layer.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.size) { box.className = `scan-box ${b.dataset.size}`; sizeSet(b.dataset.size); showSizes(); S.cons.reset(); return; }
        if (b.dataset.pick != null) return finish(choices._list[Number(b.dataset.pick)].value);
        const act = b.dataset.act;
        if (act === 'close') close();
        else if (act === 'type') { S.typed = true; close(); }
        else if (act === 'photo') q('.scan-file').click();
        else if (act === 'redo') { S.ignore = null; look(); }
        else if (act === 'next') { S.i++; S.ignore = null; look(); }
        else if (act === 'retry') { S.alive && start(); }
        else if (act === 'flash') { try { S.torch = !S.torch; await S.track.applyConstraints({ advanced: [{ torch: S.torch }] }); b.classList.toggle('on', S.torch); } catch { S.torch = false; } }
      });
      q('.scan-file').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) photo(f); });
      showSizes(); title(); layer.focus({ preventScroll: true }); start();
    });
  }

  // The camera button inside a field: scans one code into it, then offers the next empty scannable field in the same form ("Scan the next field").
  const fillInput = (input, enter) => (v) => {
    input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    if (enter) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    return '';
  };
  const stepFor = (input) => ({
    label: () => input.dataset.scanlabel || 'a code', mode: () => input.dataset.scanmode || 'text', continuous: () => input.dataset.scancontinuous === '1',
    apply: (v) => { fillInput(input, input.dataset.scanenter === '1')(v); const m = input.dataset.scanmsg && document.querySelector(input.dataset.scanmsg); return m && !m.hidden ? m.textContent.trim() : ''; },   // a screen that rejects the value (already scanned, not in stock) shows its message here
  });
  const nextInputs = (input) => { const host = input.closest('.sheet'); if (!host || input.dataset.scanenter) return []; const all = [...host.querySelectorAll('.scanfield input')], at = all.indexOf(input); return all.slice(at + 1).filter(n => !n.value.trim()).slice(0, 1); };

  A.scanner = {
    engine: 'auto',
    run,
    // Scan one code into an input; resolves when the scanner closes.
    async into(input) {
      const steps = [stepFor(input), ...nextInputs(input).map(stepFor)];
      const r = await run(steps); if (r.typed) { input.focus(); input.select?.(); }
      return r;
    },
    button: (label = 'Scan with the camera') => `<button type="button" class="scanbtn" data-scanbtn aria-label="${esc(label)}">${A.icons.camera}</button>`,
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-scanbtn]'); if (!b) return;
    const input = b.closest('.scanfield')?.querySelector('input'); if (input) { e.preventDefault(); A.scanner.into(input); }
  });
})();
