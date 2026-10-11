// APP / label — the printable shipping (address) label, its settings in Settings, and the Delivery columns added to the Sales export.
// Built in the browser from data that is already decrypted; nothing is sent anywhere. No barcode or QR code, and never the reseller's own shipping cost, item cost or profit.
(() => {
  const { esc, toast, sheet } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store, D = C.delivery;
  const L = A.labels = {};
  L.SIZES = [['4x6', '4 x 6 in (thermal printer)'], ['dymo', 'DYMO 4XL / 5XL shipping label (104 x 159 mm)'], ['half', 'Half sheet of letter'], ['letter', 'Full letter page']];
  L.TEXTS = [['standard', 'Standard'], ['larger', 'Larger (recommended)'], ['largest', 'Largest']];
  L.STYLES = [['themed', 'Themed (site look)'], ['plain', 'Plain (black and white)']];
  L.LOGOS = [['business', 'Use my business logo'], ['custom', 'Use a different logo for labels'], ['none', 'No logo']];
  const pick = (list, v, d) => list.some(x => x[0] === v) ? v : d;
  L.cfg = () => { const c = S.config().label || {}; return { size: pick(L.SIZES, c.size, '4x6'), look: pick(L.STYLES, c.look, 'themed'), border: c.border !== false, text: pick(L.TEXTS, c.text, 'larger'), logo: pick(L.LOGOS, c.logo, 'business'), customLogo: typeof c.customLogo === 'string' ? c.customLogo : '', returnAddress: D.addr(c.returnAddress) }; };
  // The picture for a choice. A removed or missing logo simply means no logo, never an error.
  L.logoFor = (choice, cfg = L.cfg()) => { const src = choice === 'custom' ? cfg.customLogo : choice === 'business' ? (S.config().mail || {}).logo : ''; return /^data:image\/(png|jpeg|webp|gif);base64,/.test(src || '') ? src : ''; };

  const TEXT_CLASS = { standard: 'txt-standard', larger: 'txt-larger', largest: 'txt-largest' }, SIZE_CLASS = { '4x6': 'size-4x6', dymo: 'size-dymo', half: 'size-half', letter: 'size-letter' }, LOOK_CLASS = { themed: 'style-themed', plain: 'style-plain' };
  L.html = (sale, o) => {
    const d = sale.data, dl = d.delivery || {}, to = dl.shipTo || {}, from = o.from || {}, fromLines = D.lines(from), logo = o.logo || '';
    const meta = [['Order', d.no], ['Date', F.day(d.ts)], ...(dl.carrier ? [['Carrier', dl.carrier]] : []), ...(dl.tracking ? [['Tracking', dl.tracking]] : [])];
    return `<div class="label ${SIZE_CLASS[o.size] || 'size-4x6'} ${LOOK_CLASS[o.look] || 'style-themed'}${o.border === false ? '' : ' has-border'} ${TEXT_CLASS[o.text] || 'txt-larger'}" data-order="${esc(d.no)}">${o.test ? '<i class="label-mark m-tl"></i><i class="label-mark m-tr"></i><i class="label-mark m-bl"></i><i class="label-mark m-br"></i>' : ''}<div class="label-top">${logo ? `<img class="label-logo" src="${esc(logo)}" alt="">` : '<span></span>'}${from.name || fromLines.length ? `<div class="label-from">${from.name ? `<b>${esc(from.name)}</b>` : ''}${fromLines.map(esc).join('<br>')}</div>` : ''}</div>
      <div class="label-tag">Ship to</div><div class="label-to"><b>${esc(to.name || d.customerName || '')}</b><span>${D.lines(to).map(esc).join('<br>')}</span></div>
      ${dl.note ? `<div class="label-note"><b>Delivery note</b><br>${esc(dl.note)}</div>` : ''}
      <div class="label-meta">${meta.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div></div>`;
  };

  // The label view: preview, choices for this print only, Print. Several sales give one label per page.
  L.open = (sales, opts = {}) => {
    sales = sales.filter(s => s && D.typeOf(s.data) === 'shipping'); if (!sales.length) return toast('There is nothing to ship in this selection.', true);
    const base = opts.cfg || L.cfg(), test = !!opts.test, st = { size: base.size, look: base.look, logo: base.logo, border: base.border !== false, text: base.text, from: { ...base.returnAddress }, edit: false };
    return sheet(`<h2>${test ? 'Test label' : sales.length === 1 ? 'Shipping label' : `Shipping labels (${sales.length})`}</h2><p class="sub no-print">Check the label, then print it, or download it as a PDF to print from any browser. Changes here are for this print only.${test ? ' This test label uses made-up sample data, not a real sale, and the corner marks show whether the printer clips any edge.' : ''}</p>
      <div class="grid g2 no-print"><div class="field"><label for="lsize">Size</label>${UI.select.html({ id: 'lsize', options: L.SIZES, value: st.size })}</div><div class="field"><label for="lstyle">Style</label>${UI.select.html({ id: 'lstyle', options: L.STYLES, value: st.look })}</div></div>
      <div class="grid g2 no-print"><div class="field"><label for="llogo">Logo</label>${UI.select.html({ id: 'llogo', options: L.LOGOS, value: st.logo })}</div><div class="field"><label for="ltext">Text size</label>${UI.select.html({ id: 'ltext', options: L.TEXTS, value: st.text })}</div></div>
      <div class="setting no-print"><div><div class="setting-title">Border around the label</div><div class="setting-desc">A thin line just inside the edge.</div></div><label class="switch"><input type="checkbox" id="lborder" aria-label="Border around the label" ${st.border ? 'checked' : ''}><i></i></label></div>
      <div class="no-print" id="lraw"></div>
      <div class="label-pages" id="lpages"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Done</button><button class="btn secondary" id="lpdf">Download PDF</button><button class="btn" id="lprint">Print</button></div>`, { wide: true, onMount: (el, close) => {
      const q = (s) => el.querySelector(s);
      const drawAddr = () => { q('#lraw').innerHTML = `<button type="button" class="linkbtn" id="lraedit">${st.edit ? 'Hide return address' : 'Change the return address for this print'}</button>${st.edit ? `<div class="delivery-box">${D.addressFields(st.from, 'rt', { country: true })}</div>` : ''}`;
        q('#lraedit').addEventListener('click', () => { st.edit = !st.edit; drawAddr(); });
        for (const k of ['n', 's', 'u', 'c', 'st', 'z', 'co']) q('#rt' + k)?.addEventListener('input', () => { st.from = D.readAddress(q('#lraw'), 'rt'); draw(); }); };
      const draw = () => { const logo = L.logoFor(st.logo, base); q('#lpages').innerHTML = sales.map(s => L.html(s, { size: st.size, look: st.look, logo, from: st.from, border: st.border, text: st.text, test })).join(''); };
      q('#lsize').addEventListener('change', (e) => { st.size = UI.select.value(e.target); draw(); });
      q('#lstyle').addEventListener('change', (e) => { st.look = UI.select.value(e.target); draw(); });
      q('#llogo').addEventListener('change', (e) => { st.logo = UI.select.value(e.target); draw(); });
      q('#ltext').addEventListener('change', (e) => { st.text = UI.select.value(e.target); draw(); });
      q('#lborder').addEventListener('change', (e) => { st.border = e.target.checked; draw(); });
      q('#lprint').addEventListener('click', () => {
        const root = document.documentElement; root.classList.add('printing', 'printing-label'); D.note(test ? 'labeltest' : 'label');
        window.addEventListener('afterprint', () => root.classList.remove('printing', 'printing-label'), { once: true }); window.print();
      });
      q('#lpdf').addEventListener('click', async () => {
        try { const logo = L.logoFor(st.logo, base); await L.pdf.download(sales, { size: st.size, look: st.look, logo, from: st.from, border: st.border, text: st.text, test }); D.note('labelpdf'); }
        catch (e) { toast(e.message || 'Could not make the PDF.', true); }
      });
      drawAddr(); draw(); void close;
    } });
  };

  // A made-up sale for the Test label button: nothing here is a real customer, and no sale is recorded.
  L.previewOpts = (l) => ({ size: l.size, look: l.look, border: l.border !== false, text: l.text, logo: L.logoFor(l.logo, l), from: l.returnAddress });
  L.sample = () => ({ id: 'sample', data: { no: 'SAMPLE-0001', ts: Date.now(), customerName: 'Sample Customer', delivery: { type: 'shipping', shipTo: { name: 'SAMPLE - Jane Customer', street: '123 Test Street', unit: 'Apt 4', city: 'Sampletown', state: 'ZZ', zip: '00000', country: '' }, carrier: 'USPS', tracking: '9400 0000 0000 0000 0000 00', note: 'Sample label, not a real parcel' } } });

  // ---- Settings > Delivery and labels (hooks called from settings.js) ----
  const S_ = A.deliverySettings = {};
  S_.init = (cfg, saved) => { cfg.delivery = { ...D.cfg() }; cfg.label = JSON.parse(JSON.stringify(L.cfg())); void saved; };
  S_.save = (cfg) => ({ delivery: { country: !!cfg.delivery.country, receiptNote: !!cfg.delivery.receiptNote, receiptDeliveryNote: !!cfg.delivery.receiptDeliveryNote }, label: { ...cfg.label, returnAddress: D.addr(cfg.label.returnAddress) } });
  const sw = (id, title, desc, on) => `<div class="setting"><div><div class="setting-title">${esc(title)}</div><div class="setting-desc">${esc(desc)}</div></div><label class="switch"><input type="checkbox" id="${id}" aria-label="${esc(title)}" ${on ? 'checked' : ''}><i></i></label></div>`;
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
    q('#lsz').addEventListener('change', (e) => { cfg.label.size = UI.select.value(e.target); prev(); });
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
