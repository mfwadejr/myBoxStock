// APP / label-pdf — builds the shipping label as a real PDF file in the browser, with the exact page size inside the file.
// Why: Chrome obeys the page size a web page asks for, but WebKit browsers (Safari, DuckDuckGo) mostly ignore it. A PDF carries its own page size, so any viewer prints it right.
// Nothing is sent anywhere. Standard fonts only (Helvetica), so characters outside Western European text print as "?". No barcode or QR code, and never the reseller's own cost or profit.
(() => {
  const A = AccountApp, L = A.labels, D = A.commerce.delivery, F = A.fmt;
  const P = L.pdf = {};
  const PT_IN = 72, PT_MM = 72 / 25.4;
  // page size in points, then the look for that size (points; they follow the on-screen label)
  const PAGES = { '4x6': [4 * PT_IN, 6 * PT_IN], dymo: [104 * PT_MM, 159 * PT_MM], half: [8.5 * PT_IN, 5.5 * PT_IN], letter: [8.5 * PT_IN, 11 * PT_IN] };
  const ART = { dymo: 102 * PT_MM };   // the printed label is narrower than the driver's page and sits centred on it
  const TEXT = {   // [from name, from lines, to name, to lines, logo w, logo h]
    standard: [9.75, 9, 15, 12.75, 64.8, 36], larger: [11.25, 9.75, 16.5, 15, 79.2, 43.2], largest: [12, 11.25, 19.5, 16.5, 93.6, 50.4] };
  const BIG = [11.25, 9, 24, 16.5, 115.2, 64.8];   // half sheet and full letter
  const CP1252 = { 0x20AC: 128, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x2026: 133 };
  const code = (ch) => { const c = ch.codePointAt(0); if (c >= 32 && c < 127) return c; if (c >= 160 && c < 256) return c; return CP1252[c] || 63; };
  const clean = (s) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ');
  const esc = (s) => { let o = ''; for (const ch of clean(s)) { const c = code(ch); o += c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : String.fromCharCode(c); } return o; };
  const bytes = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
  const n = (v) => (Math.round(v * 100) / 100).toString();
  const ctx = document.createElement('canvas').getContext('2d');
  const width = (text, size, bold) => { ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, Helvetica, sans-serif`; return ctx.measureText(clean(text)).width; };
  const wrap = (text, size, bold, max) => {
    const out = []; for (const para of clean(text).split('  ')) { let line = '';
      for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (!line || width(t, size, bold) <= max) line = t; else { out.push(line); line = w; } }
      if (line) out.push(line); }
    return out;
  };
  // A CSS colour as 0..1 numbers, read by painting one pixel (so no colour is written out in this file).
  const cssColor = (css) => { const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = 'black'; g.fillStyle = String(css || '').trim() || 'black'; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255]; };

  // The logo as a JPEG on white (a PDF image cannot be a PNG with transparency without more code); black and white for the Plain style.
  const logoJpeg = (src, plain) => new Promise((ok) => {
    if (!src) return ok(null);
    const img = new Image(); img.onload = () => {
      try { const k = Math.min(1, 700 / Math.max(img.naturalWidth, 1)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = 'white'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        if (plain) { const d = g.getImageData(0, 0, w, h), px = d.data; for (let i = 0; i < px.length; i += 4) { const v = Math.max(0, Math.min(255, ((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) - 128) * 2 + 128)); px[i] = px[i + 1] = px[i + 2] = v; } g.putImageData(d, 0, 0); }
        const bin = atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); ok({ w, h, data: u });
      } catch { ok(null); } };
    img.onerror = () => ok(null); img.src = src;
  });

  // One page's drawing commands. y runs down from the top here and is flipped when written.
  const drawLabel = (sale, o, logo, PGW, PGH) => {
    const d = sale.data, dl = d.delivery || {}, to = dl.shipTo || {}, from = o.from || {}, big = o.size === 'half' || o.size === 'letter';
    const T = big ? BIG : (TEXT[o.text] || TEXT.larger), pad = big ? 36 : 14.4, plain = o.look === 'plain', accent = plain ? [0, 0, 0] : cssColor(getComputedStyle(document.documentElement).getPropertyValue('--color-primary'));
    const out = [], H = PGH, X0 = pad, X1 = PGW - pad, MAXW = X1 - X0, MUTED = plain ? [0, 0, 0] : [0.42, 0.42, 0.45];
    const col = (c, stroke) => `${c.map(n).join(' ')} ${stroke ? 'RG' : 'rg'}`;
    const text = (s, x, y, size, bold, c = [0, 0, 0], right = false, spacing = 0) => { const w = width(s, size, bold) + spacing * clean(s).length; out.push(`BT ${col(c)} /${bold ? 'F2' : 'F1'} ${n(size)} Tf ${spacing ? n(spacing) + ' Tc ' : ''}${n(right ? x - w : x)} ${n(H - y)} Td (${esc(s)}) Tj ET`); };
    const line = (x1, y1, x2, y2, w, c) => out.push(`${col(c, true)} ${n(w)} w ${n(x1)} ${n(H - y1)} m ${n(x2)} ${n(H - y2)} l S`);
    const rect = (x, y, w, h, lw, c) => out.push(`${col(c, true)} ${n(lw)} w ${n(x)} ${n(H - y - h)} ${n(w)} ${n(h)} re S`);
    const round = (x, y, w, h, r, lw, c) => { const k = r * 0.5523, yb = H - y - h, t = yb + h;   // a rectangle with rounded corners, drawn with four curves
      out.push(`${col(c, true)} ${n(lw)} w ${n(x + r)} ${n(yb)} m ${n(x + w - r)} ${n(yb)} l ${n(x + w - r + k)} ${n(yb)} ${n(x + w)} ${n(yb + r - k)} ${n(x + w)} ${n(yb + r)} c ${n(x + w)} ${n(t - r)} l ${n(x + w)} ${n(t - r + k)} ${n(x + w - r + k)} ${n(t)} ${n(x + w - r)} ${n(t)} c ${n(x + r)} ${n(t)} l ${n(x + r - k)} ${n(t)} ${n(x)} ${n(t - r + k)} ${n(x)} ${n(t - r)} c ${n(x)} ${n(yb + r)} l ${n(x)} ${n(yb + r - k)} ${n(x + r - k)} ${n(yb)} ${n(x + r)} ${n(yb)} c S`); };
    if (o.border !== false) { const i = 0.08 * PT_IN; round(i, i, PGW - 2 * i, PGH - 2 * i, 0.12 * PT_IN, 1.1, [0, 0, 0]); }
    if (o.test) for (let i = 1; i <= 6; i++) rect(i * PT_MM, i * PT_MM, PGW - 2 * i * PT_MM, PGH - 2 * i * PT_MM, 0.85, [0, 0, 0]);   // frames 1 to 6 mm in from each edge, to see what the printer clips
    if (o.test) { const m = 0.15 * PT_IN; for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [PGW, 0, -1, 1], [0, PGH, 1, -1], [PGW, PGH, -1, -1]]) { line(cx, cy, cx + sx * m, cy, 1.1, [0, 0, 0]); line(cx, cy, cx, cy + sy * m, 1.1, [0, 0, 0]); } }
    // top: logo left, return address right
    const fromLines = D.lines(from), fh = (from.name ? T[0] * 1.3 : 0) + fromLines.length * T[1] * 1.3;
    let lw = 0, lh = 0; if (logo) { const s = Math.min(T[4] / logo.w, T[5] / logo.h); lw = logo.w * s; lh = logo.h * s; out.push(`q ${n(lw)} 0 0 ${n(lh)} ${n(X0)} ${n(H - pad - lh)} cm /Im1 Do Q`); }
    let fy = pad + T[0]; if (from.name) { text(from.name, X1, fy, T[0], true, [0, 0, 0], true); fy += T[0] * 1.3; }
    for (const l of fromLines) { text(l, X1, fy - (from.name ? 0 : T[1] - T[0]) + 0, T[1], false, [0, 0, 0], true); fy += T[1] * 1.3; }
    let y = pad + Math.max(lh, fh) + 9; line(X0, y, X1, y, 1.5, accent); y += 1.5;
    // ship to
    y += 14; text('SHIP TO', X0, y + 8.25 * 0.8, 8.25, true, MUTED, false, 0.6); y += 8.25 + 5;
    const toName = to.name || d.customerName || '';
    for (const l of wrap(toName, T[2], true, MAXW)) { y += T[2]; text(l, X0, y, T[2], true); y += T[2] * 0.3; }
    y += 2;
    for (const raw of D.lines(to)) for (const l of wrap(raw, T[3], false, MAXW)) { y += T[3]; text(l, X0, y, T[3], false); y += T[3] * 0.3; }
    // delivery note
    if (dl.note) { y += 10; const nl = wrap(dl.note, 9, false, MAXW - 12), bh = 6 + 9 * 1.3 * (nl.length + 1) + 2; rect(X0, y, MAXW, bh, 0.75, [0, 0, 0]);
      let ny = y + 3 + 9; text('Delivery note', X0 + 6, ny, 9, true); for (const l of nl) { ny += 9 * 1.3; text(l, X0 + 6, ny, 9, false); } y += bh; }
    // bottom: order, date, carrier, tracking in two columns
    const meta = [['Order', d.no], ['Date', F.day(d.ts)], ...(dl.carrier ? [['Carrier', dl.carrier]] : []), ...(dl.tracking ? [['Tracking', dl.tracking]] : [])];
    const cells = meta.map(([k, v]) => ({ k, v, w: width(v, 9.75, true) })), rows = [];
    for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
    for (const r of rows) { const tot = r.reduce((t, c) => t + c.w, 0) || 1, free = MAXW - 12 * (r.length - 1); let x = X0;
      r.forEach((c) => { c.x = x; c.cw = r.length === 1 ? free : Math.min(0.7, Math.max(0.3, c.w / tot)) * free; x += c.cw + 12; c.lines = wrap(c.v, 9.75, true, c.cw); }); }
    const rh = (r) => 9 * 1.3 + Math.max(...r.map(c => c.lines.length)) * 9.75 * 1.3 + 4, mh = rows.reduce((t, r) => t + rh(r), 0);
    let my = H - pad - mh - 9; line(X0, my, X1, my, 0.75, [0, 0, 0]); my += 9;
    for (const r of rows) { for (const c of r) { text(c.k, c.x, my + 9, 9, false, MUTED); c.lines.forEach((l, j) => text(l, c.x, my + 9 + 9.75 * 1.3 * (j + 1), 9.75, true)); } my += rh(r); }
    return out.join('\n');
  };

  P.build = async (sales, o) => {
    const [PW, PH] = PAGES[o.size] || PAGES['4x6'], logo = await logoJpeg(o.logo, o.look === 'plain'), objs = [];
    const add = (body) => objs.push(body) && objs.length;   // object numbers start at 1
    add('<< /Type /Catalog /Pages 2 0 R >>'); add(null);   // 2 = Pages, filled below
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    let img = 0; if (logo) img = add({ dict: `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, data: logo.data });
    const pages = [];
    for (const s of sales) {
      const aw = ART[o.size] || PW, k = Math.min(1, Math.max(0.9, (Number(o.fit) || 100) / 100)), sx = (Number(o.shiftX) || 0) * PT_MM, sy = (Number(o.shiftY) || 0) * PT_MM;   // Printer fit, about the top centre of the label
      const matrix = `${n(k)} 0 0 ${n(k)} ${n((PW - aw) / 2 + aw / 2 * (1 - k) + sx)} ${n(PH * (1 - k) - sy)} cm`;
      const stream = bytes(`q ${matrix}\n${drawLabel(s, o, logo, aw, PH)}\nQ`), c = add({ dict: '<<', data: stream });
      pages.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(PW)} ${n(PH)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${img ? ` /XObject << /Im1 ${img} 0 R >>` : ''} >> /Contents ${c} 0 R >>`));
    }
    objs[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(p => p + ' 0 R').join(' ')}] >>`;
    const parts = [bytes('%PDF-1.4\n')], offs = []; let pos = parts[0].length;
    const push = (u) => { parts.push(u); pos += u.length; };
    objs.forEach((b, i) => { offs.push(pos); push(bytes(`${i + 1} 0 obj\n`));
      if (typeof b === 'string') push(bytes(b)); else { push(bytes(`${b.dict} /Length ${b.data.length} >>\nstream\n`)); push(b.data); push(bytes('\nendstream')); }
      push(bytes('\nendobj\n')); });
    const xref = pos; push(bytes(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(v => String(v).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    return new Blob(parts, { type: 'application/pdf' });
  };

  P.download = async (sales, o) => {
    const blob = await P.build(sales, o), name = o.test ? 'test-label.pdf' : sales.length === 1 ? `shipping-label-${clean(sales[0].data.no).replace(/[^A-Za-z0-9_-]+/g, '') || 'order'}.pdf` : 'shipping-labels.pdf';
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.className = 'sr-only'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
})();
