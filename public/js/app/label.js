// APP / label — the printable shipping (address) label, its settings in Settings, and the Delivery columns added to the Sales export.
// Built in the browser from data that is already decrypted; nothing is sent anywhere. No barcode or QR code, and never the reseller's own shipping cost, item cost or profit.
(() => {
  const { esc, toast, sheet } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store, D = C.delivery;
  const L = A.labels = {};
  L.SIZES = [['4x6', '4 x 6 in (thermal printer)'], ['dymo', 'DYMO 4XL / 5XL shipping label (102 x 159 mm)'], ['half', 'Half sheet of letter'], ['letter', 'Full letter page']];
  const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
  const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  L.SHIFT_X = range(-6, 6).map(v => [String(v), v === 0 ? 'Centered' : `${Math.abs(v)} mm ${v < 0 ? 'left' : 'right'}`]);
  L.SHIFT_Y = range(-6, 6).map(v => [String(v), v === 0 ? 'Top of page' : `${Math.abs(v)} mm ${v < 0 ? 'up' : 'down'}`]);
  L.FITS = range(90, 100).reverse().map(v => [String(v), v === 100 ? '100% (full size)' : `${v}%`]);
  L.TEXTS = [['standard', 'Standard'], ['larger', 'Larger (recommended)'], ['largest', 'Largest']];
  L.STYLES = [['themed', 'Themed (site look)'], ['plain', 'Plain (black and white)']];
  L.LOGOS = [['business', 'Use my business logo'], ['custom', 'Use a different logo for labels'], ['none', 'No logo']];
  const pick = (list, v, d) => list.some(x => x[0] === v) ? v : d;
  L.cfg = () => { const c = S.config().label || {}; return { size: pick(L.SIZES, c.size, '4x6'), look: pick(L.STYLES, c.look, 'themed'), border: c.border !== false, text: pick(L.TEXTS, c.text, 'larger'), logo: pick(L.LOGOS, c.logo, 'business'), customLogo: typeof c.customLogo === 'string' ? c.customLogo : '', returnAddress: D.addr(c.returnAddress), fits: L.normFits(c.fits) }; };

  // ---- Printer fit: where a printer really prints differs by printer, driver and browser, so the fit belongs to a browser and a label size ----
  // It is kept in this browser (local storage). Administrators' fits are also kept in the account settings so another browser can offer them ("Use the settings from ...").
  L.DIM = { '4x6': [101.6, 152.4], dymo: [102, 159], half: [215.9, 139.7], letter: [215.9, 279.4] };   // label width and height in mm
  L.START = { dymo: { x: 0, y: 2, fit: 95 } };                                                          // a starting point that suits the DYMO 4XL / 5XL until the browser is fitted
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const normFit = (f) => ({ x: num(f?.x, -6, 6, 0), y: num(f?.y, -6, 6, 0), fit: num(f?.fit, 90, 100, 100) });
  const normSizes = (z) => Object.fromEntries(Object.keys(L.DIM).filter(k => z && z[k]).map(k => [k, normFit(z[k])]));
  L.normFits = (list) => (Array.isArray(list) ? list : []).filter(e => e && typeof e.id === 'string' && e.id).map(e => ({ id: e.id.slice(0, 40), name: String(e.name || 'Browser').slice(0, 60), at: Number(e.at) || 0, sizes: normSizes(e.sizes) })).filter(e => Object.keys(e.sizes).length).sort((a, b) => b.at - a.at).slice(0, 10);
  L.withFit = (list, mine) => L.normFits([{ id: mine.id, name: mine.name, at: Date.now(), sizes: mine.sizes }, ...L.normFits(list).filter(e => e.id !== mine.id)]);
  L.browserName = () => { const ua = navigator.userAgent || '', b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /DuckDuckGo/.test(ua) ? 'DuckDuckGo' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser', o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''; return o ? `${b} on ${o}` : b; };
  const KEY = () => `mbs.labelfit.${A.me?.accountCode || A.me?.id || 'a'}`;
  let mem = null;                                                                                        // used when this browser will not keep local storage
  const readLocal = () => { try { const v = JSON.parse(localStorage.getItem(KEY()) || 'null'); if (v && typeof v.id === 'string' && v.sizes) return v; } catch { /* blocked or damaged: start again */ } return mem; };
  L.me = () => { const v = readLocal(); return v ? { id: v.id, name: v.name || L.browserName(), sizes: normSizes(v.sizes) } : { id: Vault.newId(), name: L.browserName(), sizes: {} }; };
  L.myFit = (size) => { const f = readLocal()?.sizes?.[size]; return f ? normFit(f) : null; };
  L.fitText = (f) => { const move = [f.x ? `${Math.abs(f.x)} mm ${f.x < 0 ? 'left' : 'right'}` : '', f.y ? `${Math.abs(f.y)} mm ${f.y < 0 ? 'up' : 'down'}` : ''].filter(Boolean).join(', '); return !move && f.fit === 100 ? 'no adjustment' : `${move || 'centered'}, ${f.fit}%`; };
  // Saves this browser's fit for one label size. An Administrator's fit is also put in the account settings so other browsers can offer it.
  L.saveMine = async (size, f, { share = true } = {}) => {
    const me = L.me(); me.name = L.browserName(); me.sizes = { ...me.sizes, [size]: normFit(f) }; mem = me;
    try { localStorage.setItem(KEY(), JSON.stringify(me)); } catch { /* kept for this visit only */ }
    if (share && A.can('users.manage')) { try { const cfg = S.config(); await S.saveConfig({ ...cfg, label: { ...(cfg.label || {}), fits: L.withFit(cfg.label?.fits, me) } }); } catch { /* the fit still works in this browser */ } }
    return me;
  };
  // Fits other browsers saved in the account, newest first, for this label size.
  L.suggest = (size) => L.normFits(S.config().label?.fits).filter(e => e.id !== L.me().id && e.sizes[size]).slice(0, 2);
  // From what the printer cut off at each edge (mm, read from the calibration page) to a shift and a size: the label is shrunk about its centre to fit what the printer reaches, and centred in it.
  L.fitFrom = (size, m) => { const [W, H] = L.DIM[size] || L.DIM['4x6'], t = Math.max(0, Number(m.t) || 0), b = Math.max(0, Number(m.b) || 0), l = Math.max(0, Number(m.l) || 0), r = Math.max(0, Number(m.r) || 0);
    const k = Math.min((W - l - r) / W, (H - t - b) / H); return { x: clamp(Math.round((l - r) / 2), -6, 6), y: clamp(Math.round((t - b) / 2), -6, 6), fit: clamp(Math.floor(k * 100), 90, 100) }; };
  // The calibration page: a numbered ruler at the middle of each edge. Printed with no adjustment, the lowest number you can read at an edge is how far in the printer starts.
  const FIT_Z = { n: 'fit-n', s: 'fit-s', b: 'fit-b', h: 'fit-h' }, FIT_A = { start: 'fit-start', middle: 'fit-middle', end: 'fit-end' };
  L.calHtml = (size) => {
    const [W, H] = L.DIM[size] || L.DIM['4x6'], cx = W / 2, cy = H / 2, out = [];
    const ln = (x1, y1, x2, y2) => out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
    const tx = (x, y, t, a = 'middle', z = 'n') => out.push(`<text x="${x}" y="${y}" class="${FIT_Z[z]} ${FIT_A[a]}">${t}</text>`);
    for (let d = 0; d <= 9; d++) {
      const even = d % 2 === 0;
      ln(d, cy - 8, d, cy + 8); tx(d, even ? cy - 9 : cy + 11, d);                         // left edge: upright lines, even numbers above, odd below
      ln(W - d, cy - 8, W - d, cy + 8); tx(W - d, even ? cy - 9 : cy + 11, d);               // right edge
      ln(cx - 8, d, cx + 8, d); even ? tx(cx - 9, d + 0.8, d, 'end') : tx(cx + 9, d + 0.8, d, 'start');                           // top edge: level lines, even numbers left, odd right
      ln(cx - 8, H - d, cx + 8, H - d); even ? tx(cx - 9, H - d + 0.8, d, 'end') : tx(cx + 9, H - d + 0.8, d, 'start');           // bottom edge
    }
    tx(cx, 18, 'TOP', 'middle', 'b'); tx(cx, H - 15, 'BOTTOM', 'middle', 'b'); tx(13, cy + 1, 'LEFT', 'start', 'b'); tx(W - 13, cy + 1, 'RIGHT', 'end', 'b');
    tx(cx, cy - 22, 'FIT TEST', 'middle', 'h'); tx(cx, cy - 15, 'At each edge, read the lowest', 'middle', 's'); tx(cx, cy - 11.5, 'number you can see clearly.', 'middle', 's');
    return `<div class="label ${SIZE_CLASS[size] || 'size-4x6'} fitcal" data-sx="0" data-sy="0" data-fit="100"><svg class="fitcal-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fit test page with a numbered ruler at each edge">${out.join('')}</svg></div>`;
  };
  // The Fit to my printer sheet: print the calibration page, then say what printed. Resolves with { size, f } to save, or null.
  L.calibrate = (size0, { lock = false } = {}) => sheet(`<h2>Fit to my printer</h2><p class="sub no-print">Printers place a label a little differently in each browser. Print one test page, then tell the app what you can read on it. The fit is saved for this browser and this label size, and takes about a minute.</p>
      <div class="field no-print"><label for="csize">Label size</label>${UI.select.html({ id: 'csize', options: L.SIZES, value: size0 })}</div>
      <ol class="no-print"><li>Load your labels and press <b>Print fit test page</b>. Choose your label printer and the same paper size and settings you use for labels (Margins None, Scale 100% or Default).</li><li>On the printed page, look at each edge. Numbers closer to the edge than your printer reaches are cut off or missing.</li><li>Enter the lowest number you can read clearly at the top, bottom, left and right. Enter 0 if every number printed.</li></ol>
      <div class="label-pages" id="cpage"></div>
      <div class="grid g2 no-print"><div class="field"><label for="fit-t">Top edge</label><input type="number" id="fit-t" min="0" max="9" step="1" inputmode="numeric" autocomplete="off"></div><div class="field"><label for="fit-b">Bottom edge</label><input type="number" id="fit-b" min="0" max="9" step="1" inputmode="numeric" autocomplete="off"></div><div class="field"><label for="fit-l">Left edge</label><input type="number" id="fit-l" min="0" max="9" step="1" inputmode="numeric" autocomplete="off"></div><div class="field"><label for="fit-r">Right edge</label><input type="number" id="fit-r" min="0" max="9" step="1" inputmode="numeric" autocomplete="off"></div></div>
      <div class="banner blue no-print" id="cres" hidden></div>
      <div class="actions no-print"><button class="btn secondary" data-cancel>Cancel</button><button class="btn secondary" id="cprint">Print fit test page</button><button class="btn" id="csave" disabled>Save fit</button></div>`, { wide: true, onMount: (el, close) => {
    const q = (s) => el.querySelector(s); let size = size0;
    if (lock) q('#csize').closest('.field').hidden = true;
    const page = () => { q('#cpage').innerHTML = L.calHtml(size); };
    const read = () => { const v = ['t', 'b', 'l', 'r'].map(k => q("#fit-" + k).value.trim()), ok = v.every(x => /^\d$/.test(x)); return ok ? L.fitFrom(size, { t: +v[0], b: +v[1], l: +v[2], r: +v[3] }) : null; };
    const show = () => { const f = read(); q('#cres').hidden = !f; q('#csave').disabled = !f; if (f) q('#cres').textContent = `Result: ${L.fitText(f)}.`; return f; };
    q('#csize').addEventListener('change', (e) => { size = UI.select.value(e.target); page(); show(); });
    for (const k of ['t', 'b', 'l', 'r']) q("#fit-" + k).addEventListener('input', show);
    q('#cprint').addEventListener('click', () => { const root = document.documentElement; root.classList.add('printing', 'printing-label'); D.note('labelfit'); window.addEventListener('afterprint', () => root.classList.remove('printing', 'printing-label'), { once: true }); window.print(); });
    q('#csave').addEventListener('click', () => { const f = show(); if (f) close({ size, f }); });
    page();
  } });

  // The picture for a choice. A removed or missing logo simply means no logo, never an error.
  L.logoFor = (choice, cfg = L.cfg()) => { const src = choice === 'custom' ? cfg.customLogo : choice === 'business' ? (S.config().mail || {}).logo : ''; return /^data:image\/(png|jpeg|webp|gif);base64,/.test(src || '') ? src : ''; };

  const TEXT_CLASS = { standard: 'txt-standard', larger: 'txt-larger', largest: 'txt-largest' }, SIZE_CLASS = { '4x6': 'size-4x6', dymo: 'size-dymo', half: 'size-half', letter: 'size-letter' }, LOOK_CLASS = { themed: 'style-themed', plain: 'style-plain' };
  L.html = (sale, o) => {
    const d = sale.data, dl = d.delivery || {}, to = dl.shipTo || {}, from = o.from || {}, fromLines = D.lines(from), logo = o.logo || '';
    const meta = [['Order', d.no], ['Date', F.day(d.ts)], ...(dl.carrier ? [['Carrier', dl.carrier]] : []), ...(dl.tracking ? [['Tracking', dl.tracking]] : [])];
    return `<div class="label ${SIZE_CLASS[o.size] || 'size-4x6'} ${LOOK_CLASS[o.look] || 'style-themed'}${o.border === false ? '' : ' has-border'} ${TEXT_CLASS[o.text] || 'txt-larger'}" data-sx="${num(o.shiftX, -6, 6, 0)}" data-sy="${num(o.shiftY, -6, 6, 0)}" data-fit="${num(o.fit, 90, 100, 100)}" data-order="${esc(d.no)}"><div class="label-top">${logo ? `<img class="label-logo" src="${esc(logo)}" alt="">` : '<span></span>'}${from.name || fromLines.length ? `<div class="label-from">${from.name ? `<b>${esc(from.name)}</b>` : ''}${fromLines.map(esc).join('<br>')}</div>` : ''}</div>
      <div class="label-tag">Ship to</div><div class="label-to"><b>${esc(to.name || d.customerName || '')}</b><span>${D.lines(to).map(esc).join('<br>')}</span></div>
      ${dl.note ? `<div class="label-note"><b>Delivery note</b><br>${esc(dl.note)}</div>` : ''}
      <div class="label-meta">${[meta.filter(m => m[0] === 'Order' || m[0] === 'Date'), meta.filter(m => m[0] === 'Carrier' || m[0] === 'Tracking')].filter(r => r.length).map(r => `<div class="label-meta-row">${r.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div>`).join('')}</div></div>`;
  };

  // The label view: preview, choices for this print only, Print. Several sales give one label per page.
  L.open = (sales, opts = {}) => {
    sales = sales.filter(s => s && D.typeOf(s.data) === 'shipping'); if (!sales.length) return toast('There is nothing to ship in this selection.', true);
    const base = opts.cfg || L.cfg(), test = !!opts.test, st = { size: base.size, look: base.look, logo: base.logo, border: base.border !== false, text: base.text, shiftX: 0, shiftY: 0, fit: 100, ready: false, tweak: false, from: { ...base.returnAddress }, edit: false };
    return sheet(`<h2>${test ? 'Test label' : sales.length === 1 ? 'Shipping label' : `Shipping labels (${sales.length})`}</h2><p class="sub no-print">Check the label, then print it, or download it as a PDF to print from any browser. Changes here are for this print only.${test ? ' This test label uses made-up sample data, not a real sale. Check that the border is complete on all four sides.' : ''}</p>
      <div class="grid g2 no-print"><div class="field"><label for="lsize">Size</label>${UI.select.html({ id: 'lsize', options: L.SIZES, value: st.size })}</div><div class="field"><label for="lstyle">Style</label>${UI.select.html({ id: 'lstyle', options: L.STYLES, value: st.look })}</div></div>
      <div class="grid g2 no-print"><div class="field"><label for="llogo">Logo</label>${UI.select.html({ id: 'llogo', options: L.LOGOS, value: st.logo })}</div><div class="field"><label for="ltext">Text size</label>${UI.select.html({ id: 'ltext', options: L.TEXTS, value: st.text })}</div></div>
      <div class="no-print" id="lfitbox"></div>
      <div class="setting no-print"><div><div class="setting-title">Border around the label</div><div class="setting-desc">A thin line just inside the edge.</div></div><label class="switch"><input type="checkbox" id="lborder" aria-label="Border around the label" ${st.border ? 'checked' : ''}><i></i></label></div>
      <div class="no-print" id="lraw"></div>
      <div class="label-pages" id="lpages"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Done</button><button class="btn secondary" id="lpdf" disabled>Download PDF</button><button class="btn" id="lprint" disabled>Print</button></div>`, { wide: true, onMount: (el, close) => {
      const q = (s) => el.querySelector(s);
      const drawAddr = () => { q('#lraw').innerHTML = `<button type="button" class="linkbtn" id="lraedit">${st.edit ? 'Hide return address' : 'Change the return address for this print'}</button>${st.edit ? `<div class="delivery-box">${D.addressFields(st.from, 'rt', { country: true })}</div>` : ''}`;
        q('#lraedit').addEventListener('click', () => { st.edit = !st.edit; drawAddr(); });
        for (const k of ['n', 's', 'u', 'c', 'st', 'z', 'co']) q('#rt' + k)?.addEventListener('input', () => { st.from = D.readAddress(q('#lraw'), 'rt'); draw(); }); };
      const draw = () => { const logo = L.logoFor(st.logo, base); q('#lpages').innerHTML = sales.map(s => L.html(s, { size: st.size, look: st.look, logo, from: st.from, border: st.border, text: st.text, shiftX: st.shiftX, shiftY: st.shiftY, fit: st.fit, test })).join(''); };
      q('#lsize').addEventListener('change', (e) => { st.size = UI.select.value(e.target); useFit(startFit(st.size)); drawFit(); draw(); });
      q('#lstyle').addEventListener('change', (e) => { st.look = UI.select.value(e.target); draw(); });
      q('#llogo').addEventListener('change', (e) => { st.logo = UI.select.value(e.target); draw(); });
      q('#ltext').addEventListener('change', (e) => { st.text = UI.select.value(e.target); draw(); });
      q('#lborder').addEventListener('change', (e) => { st.border = e.target.checked; draw(); });
      // Printer fit for this browser and this label size: choose how to fit once, then it is remembered.
      const startFit = (size) => L.myFit(size) || (size === 'dymo' || L.suggest(size).length ? null : { x: 0, y: 0, fit: 100 });   // only DYMO, or a size another browser has fitted, must ask first
      const useFit = (f) => { st.ready = !!f; st.shiftX = f?.x || 0; st.shiftY = f?.y || 0; st.fit = f?.fit || 100; q('#lprint').disabled = q('#lpdf').disabled = !st.ready; };
      const choose = async (f) => { try { await L.saveMine(st.size, f); useFit(f); toast('Fit saved for this browser'); } catch (er) { toast(er.message, true); } drawFit(); draw(); };
      const fitNow = async () => { const r = await L.calibrate(st.size, { lock: true }); if (r) await choose(r.f); };
      const drawFit = () => {
        const sugg = L.suggest(st.size), start = L.START[st.size];
        if (!st.ready) q('#lfitbox').innerHTML = `<div class="banner mt-md" id="lask"><div class="strong">This browser is not set up for your label printer</div><div class="hint">A label prints in a slightly different place in each browser and printer. Choose how to fit it before you print. It is remembered for this browser.</div><div class="row wrap mt-sm">${sugg.map((e, i) => `<button type="button" class="btn secondary small" data-use="${i}">Use the settings from ${esc(e.name)} (${esc(L.fitText(e.sizes[st.size]))})</button>`).join('')}${start ? `<button type="button" class="btn secondary small" id="lstart">Use the suggested start (${esc(L.fitText(start))})</button>` : ''}<button type="button" class="btn small" id="lfitcal">Fit to my printer</button><button type="button" class="btn secondary small" id="lnone">Print without adjusting</button></div></div>`;
        else q('#lfitbox').innerHTML = `<div class="row spread wrap mt-md"><span class="hint">Printer fit for this browser: ${esc(L.fitText({ x: st.shiftX, y: st.shiftY, fit: st.fit }))}</span><span class="row"><button type="button" class="linkbtn" id="lfitcal">Fit to my printer again</button><button type="button" class="linkbtn" id="lfittw">${st.tweak ? 'Hide tweak' : 'Tweak'}</button></span></div>${st.tweak ? `<div class="grid g3 mt-sm"><div class="field"><label for="lfx">Move left or right</label>${UI.select.html({ id: 'lfx', options: L.SHIFT_X, value: String(st.shiftX) })}</div><div class="field"><label for="lfy">Move up or down</label>${UI.select.html({ id: 'lfy', options: L.SHIFT_Y, value: String(st.shiftY) })}</div><div class="field"><label for="lfit">Printed size</label>${UI.select.html({ id: 'lfit', options: L.FITS, value: String(st.fit) })}</div></div><div class="row mt-sm"><button type="button" class="btn secondary small" id="lfsave">Save as this browser's fit</button><span class="hint">Tweaks here are for this print until you save them.</span></div>` : ''}`;
        q('#lfitcal')?.addEventListener('click', fitNow);
        q('#lnone')?.addEventListener('click', () => choose({ x: 0, y: 0, fit: 100 }));
        q('#lstart')?.addEventListener('click', () => choose(L.START[st.size]));
        q('#lfitbox').querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => choose(sugg[Number(b.dataset.use)].sizes[st.size])));
        q('#lfittw')?.addEventListener('click', () => { st.tweak = !st.tweak; drawFit(); });
        q('#lfx')?.addEventListener('change', (e) => { st.shiftX = Number(UI.select.value(e.target)); draw(); });
        q('#lfy')?.addEventListener('change', (e) => { st.shiftY = Number(UI.select.value(e.target)); draw(); });
        q('#lfit')?.addEventListener('change', (e) => { st.fit = Number(UI.select.value(e.target)); draw(); });
        q('#lfsave')?.addEventListener('click', () => choose({ x: st.shiftX, y: st.shiftY, fit: st.fit }));
      };
      q('#lprint').addEventListener('click', () => {
        const root = document.documentElement; root.classList.add('printing', 'printing-label'); D.note(test ? 'labeltest' : 'label');
        window.addEventListener('afterprint', () => root.classList.remove('printing', 'printing-label'), { once: true }); window.print();
      });
      q('#lpdf').addEventListener('click', async () => {
        try { const logo = L.logoFor(st.logo, base); await L.pdf.download(sales, { size: st.size, look: st.look, logo, from: st.from, border: st.border, text: st.text, shiftX: st.shiftX, shiftY: st.shiftY, fit: st.fit, test }); D.note('labelpdf'); }
        catch (e) { toast(e.message || 'Could not make the PDF.', true); }
      });
      useFit(startFit(st.size)); drawFit(); drawAddr(); draw(); void close;
    } });
  };

  // A made-up sale for the Test label button: nothing here is a real customer, and no sale is recorded.
  L.previewOpts = (l) => ({ size: l.size, look: l.look, border: l.border !== false, text: l.text, logo: L.logoFor(l.logo, l), from: l.returnAddress });
  L.sample = () => ({ id: 'sample', data: { no: 'SAMPLE-0001', ts: Date.now(), customerName: 'Sample Customer', delivery: { type: 'shipping', shipTo: { name: 'SAMPLE - Jane Customer', street: '123 Test Street', unit: 'Apt 4', city: 'Sampletown', state: 'ZZ', zip: '00000', country: '' }, carrier: 'USPS', tracking: '9400 0000 0000 0000 0000 00', note: 'Sample label, not a real parcel' } } });

  // ---- Settings > Delivery and labels (hooks called from settings.js) ----
  const S_ = A.deliverySettings = {};
  S_.init = (cfg, saved) => { cfg.delivery = { ...D.cfg() }; cfg.label = JSON.parse(JSON.stringify(L.cfg())); void saved; };
  S_.save = (cfg) => ({ delivery: { country: !!cfg.delivery.country, receiptNote: !!cfg.delivery.receiptNote, receiptDeliveryNote: !!cfg.delivery.receiptDeliveryNote }, label: { ...cfg.label, returnAddress: D.addr(cfg.label.returnAddress), fits: L.normFits(cfg.label.fits) } });
  const sw = (id, title, desc, on) => `<div class="setting"><div><div class="setting-title">${esc(title)}</div><div class="setting-desc">${esc(desc)}</div></div><label class="switch"><input type="checkbox" id="${id}" aria-label="${esc(title)}" ${on ? 'checked' : ''}><i></i></label></div>`;
  let tweakOpen = false;
  const fitCard = (cfg) => { const size = cfg.label.size, me = L.me(), f = L.myFit(size), others = L.normFits(cfg.label.fits).filter(e => e.id !== me.id);
    return `<div class="row spread wrap mt-md"><span>This browser (${esc(me.name)}), ${esc(L.SIZES.find(x => x[0] === size)?.[1] || size)}: <b>${esc(f ? L.fitText(f) : 'not set up')}</b></span><span class="row"><button class="btn secondary small" id="lsfit" type="button">Fit to my printer</button><button class="linkbtn" id="lstw" type="button">${tweakOpen ? 'Hide tweak' : 'Tweak'}</button></span></div>
      ${tweakOpen ? `<div class="grid g3 mt-md"><div class="field"><label for="lsx">Move left or right</label>${UI.select.html({ id: 'lsx', options: L.SHIFT_X, value: String(f?.x || 0) })}</div><div class="field"><label for="lsy">Move up or down</label>${UI.select.html({ id: 'lsy', options: L.SHIFT_Y, value: String(f?.y || 0) })}</div><div class="field"><label for="lsf">Printed size</label>${UI.select.html({ id: 'lsf', options: L.FITS, value: String(f?.fit || 100) })}</div></div>` : ''}
      ${others.length ? `<div class="strong mt-md">Other browsers</div>${others.map(e => `<div class="row spread wrap"><span>${esc(e.name)}: ${Object.entries(e.sizes).map(([k, v]) => `${esc(L.SIZES.find(x => x[0] === k)?.[1].split(' (')[0] || k)} ${esc(L.fitText(v))}`).join('; ')}</span><button class="linkbtn" type="button" data-fitrm="${esc(e.id)}">Forget</button></div>`).join('')}<div class="hint">These are offered when someone prints from a browser that has no fit yet.</div>` : ''}`;
  };
  S_.html = (cfg) => {
    const lg = cfg.label.customLogo;
    return `<div class="card mt-lg"><h3>Delivery and labels</h3><div class="sub">How sales are delivered, and the shipping label you print for parcels. Saved encrypted with the rest of your account data.</div>
      ${sw('dcountry', 'Ask for a country on addresses', 'Off by default. Turn on if you ship outside your own country.', cfg.delivery.country)}
      ${sw('drnote', 'Show the pickup or meet note on the receipt', 'Off by default: these notes are for you.', cfg.delivery.receiptNote)}
      ${sw('drdn', 'Show the delivery note on the receipt', 'Off by default. The delivery note always prints on the label.', cfg.delivery.receiptDeliveryNote)}
      <h3 class="mt-lg">Return address on labels</h3>${D.addressFields(cfg.label.returnAddress, 'ra', { country: true })}
      <div class="grid g2"><div class="field"><label for="lsz">Default label size</label>${UI.select.html({ id: 'lsz', options: L.SIZES, value: cfg.label.size })}</div><div class="field"><label for="lst">Label style</label>${UI.select.html({ id: 'lst', options: L.STYLES, value: cfg.label.look })}</div></div>
      <div class="setting"><div><div class="setting-title">Border around the label</div><div class="setting-desc">A thin line just inside the edge of the label, with a gap to the rules and text. On by default.</div></div><label class="switch"><input type="checkbox" id="lbord" aria-label="Border around the label" ${cfg.label.border ? 'checked' : ''}><i></i></label></div>
      <div class="field"><label for="ltx">Label text size</label>${UI.select.html({ id: 'ltx', options: L.TEXTS, value: cfg.label.text })}<div class="hint">Makes the logo, return address and ship-to address larger or smaller on 4 x 6 in and DYMO labels.</div></div>
      <h3 class="mt-lg">Printer fit</h3><div class="hint">Printers rarely print a label exactly where you expect, and each browser can differ. Fit is saved for this browser and each label size. Use Fit to my printer to measure it, or tweak the numbers by hand.</div>
      ${fitCard(cfg)}
      <div class="field"><label for="llg">Label logo</label>${UI.select.html({ id: 'llg', options: L.LOGOS, value: cfg.label.logo })}</div>
      <div id="llbox" ${cfg.label.logo === 'custom' ? '' : 'hidden'}><div class="row mt-md"><div id="llpic">${lg ? `<img class="brand-logo" src="${esc(lg)}" alt="Label logo">` : '<span class="brand-logo empty">No logo</span>'}</div><button class="btn secondary" id="llpick" type="button">Choose logo</button><button class="btn secondary" id="llrm" type="button" ${lg ? '' : 'disabled'}>Remove logo</button><input type="file" id="llfile" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Label logo file" hidden></div><div class="hint">Made small automatically. Plain style prints it in black and white.</div></div>
      <h3 class="mt-lg">Preview</h3><div class="label-pages" id="lprev">${L.html(L.sample(), L.previewOpts(cfg.label))}</div>
      <div class="row mt-md"><button class="btn secondary" id="ltest" type="button">Print test label</button><span class="text-sm muted">Uses made-up sample data and the settings above, even before you save. No sale is recorded.</span></div>
      <div class="hint mt-md">Press Save changes at the top of the page to keep these settings.</div></div>`;
  };
  S_.wire = (root, cfg, draw) => {
    const q = (s) => root.querySelector(s);
    if (!q('#dcountry')) return;
    q('#dcountry').addEventListener('change', (e) => { cfg.delivery.country = e.target.checked; });
    q('#drnote').addEventListener('change', (e) => { cfg.delivery.receiptNote = e.target.checked; });
    q('#drdn').addEventListener('change', (e) => { cfg.delivery.receiptDeliveryNote = e.target.checked; });
    for (const k of ['n', 's', 'u', 'c', 'st', 'z', 'co']) q('#ra' + k)?.addEventListener('input', () => { cfg.label.returnAddress = D.readAddress(root, 'ra'); prev(); });
    const prev = () => { q('#lprev').innerHTML = L.html(L.sample(), L.previewOpts(cfg.label)); };
    q('#lsz').addEventListener('change', (e) => { cfg.label.size = UI.select.value(e.target); prev(); draw(); });
    const mine = async (patch) => { const size = cfg.label.size, cur = L.myFit(size) || { x: 0, y: 0, fit: 100 }; const me = await L.saveMine(size, { ...cur, ...patch }, { share: false }); cfg.label.fits = L.withFit(cfg.label.fits, me); draw(); };
    q('#lsx')?.addEventListener('change', (e) => mine({ x: Number(UI.select.value(e.target)) }));
    q('#lsy')?.addEventListener('change', (e) => mine({ y: Number(UI.select.value(e.target)) }));
    q('#lsf')?.addEventListener('change', (e) => mine({ fit: Number(UI.select.value(e.target)) }));
    q('#lstw').addEventListener('click', () => { tweakOpen = !tweakOpen; draw(); });
    q('#lsfit').addEventListener('click', async () => { const r = await L.calibrate(cfg.label.size); if (!r) return; cfg.label.size = r.size; const me = await L.saveMine(r.size, r.f, { share: false }); cfg.label.fits = L.withFit(cfg.label.fits, me); toast('Fit saved for this browser. Press Save changes to keep it for your other browsers to see.'); draw(); });
    root.querySelectorAll('[data-fitrm]').forEach(b => b.addEventListener('click', () => { cfg.label.fits = L.normFits(cfg.label.fits).filter(e => e.id !== b.dataset.fitrm); draw(); }));
    q('#ltx').addEventListener('change', (e) => { cfg.label.text = UI.select.value(e.target); prev(); });
    q('#lst').addEventListener('change', (e) => { cfg.label.look = UI.select.value(e.target); prev(); });
    q('#lbord').addEventListener('change', (e) => { cfg.label.border = e.target.checked; prev(); });
    q('#ltest').addEventListener('click', () => L.open([L.sample()], { test: true, cfg: { ...cfg.label, returnAddress: D.addr(cfg.label.returnAddress) } }));
    q('#llg').addEventListener('change', (e) => { cfg.label.logo = UI.select.value(e.target); q('#llbox').hidden = cfg.label.logo !== 'custom'; prev(); });
    q('#llpick').addEventListener('click', () => q('#llfile').click());
    q('#llrm').addEventListener('click', () => { cfg.label.customLogo = ''; draw(); });
    q('#llfile').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { cfg.label.customLogo = await A.shrinkLogo(f); draw(); } catch (er) { toast(er.message, true); } });
  };

  // ---- Sales export: the Delivery columns follow the existing ones ----
  const base = A.salesTable;
  if (base) A.salesTable = (entries) => { const t = base(entries); return { headers: [...t.headers, ...D.csvHeaders], rows: t.rows.map((r, i) => [...r, ...D.csvRow(entries[i].data)]) }; };
})();
