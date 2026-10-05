// APP / scan-decode — reads barcodes and QR codes from a picture: the phone's own BarcodeDetector when it has one, otherwise the bundled pure-JavaScript ZXing decoder (loaded only when first needed).
(() => {
  const FORMATS = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'itf', 'codabar'];
  const A = window.AccountApp = window.AccountApp || {};
  let zxingLoad = null, native = null;

  const loadZxing = () => zxingLoad || (zxingLoad = new Promise((ok, no) => {
    if (window.ZXing) return ok(window.ZXing);
    const s = document.createElement('script'); s.src = '/js/vendor/zxing.min.js'; s.onload = () => ok(window.ZXing); s.onerror = () => { zxingLoad = null; no(new Error('The scanner could not be loaded. Check your connection and try again.')); }; document.head.append(s);
  }));

  const mid = (pts) => pts && pts.length ? { x: pts.reduce((t, p) => t + p.x, 0) / pts.length, y: pts.reduce((t, p) => t + p.y, 0) / pts.length } : null;

  async function nativeDetector() {
    if (native !== null) return native;
    native = false;
    try { if ('BarcodeDetector' in window) { const have = await BarcodeDetector.getSupportedFormats(); const use = FORMATS.filter(f => have.includes(f)); if (use.length) native = new BarcodeDetector({ formats: use }); } } catch { native = false; }
    return native;
  }

  // ZXing finds one code per picture, so look at the whole picture and at overlapping horizontal bands; each hit carries where it was seen.
  function zxingReader(Z) {
    const hints = new Map(), map = { code_128: 'CODE_128', code_39: 'CODE_39', ean_13: 'EAN_13', ean_8: 'EAN_8', upc_a: 'UPC_A', upc_e: 'UPC_E', qr_code: 'QR_CODE', data_matrix: 'DATA_MATRIX', itf: 'ITF', codabar: 'CODABAR' };
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, FORMATS.map(f => Z.BarcodeFormat[map[f]]).filter(v => v !== undefined)); hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const reader = new Z.MultiFormatReader(); reader.setHints(hints);
    const lum = (d, w, h, y0, y1) => { const out = new Uint8ClampedArray(w * (y1 - y0)); let k = 0; for (let y = y0; y < y1; y++) for (let x = 0, i = (y * w) * 4; x < w; x++, i += 4) out[k++] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8; return out; };
    const one = (d, w, h, y0, y1, tryInverted) => {
      const src = new Z.RGBLuminanceSource(lum(d, w, h, y0, y1), w, y1 - y0);
      for (const inv of tryInverted ? [false, true] : [false]) { try { const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(inv ? src.invert() : src)); const r = reader.decodeWithState(bmp); const p = r.getResultPoints() || [];
        const c = mid(p.map(q => ({ x: q.getX(), y: q.getY() }))); return { value: r.getText(), format: String(r.getBarcodeFormat()), x: c ? c.x : w / 2, y: (c ? c.y : (y1 - y0) / 2) + y0 }; } catch { /* nothing here */ } finally { reader.reset(); } }
      return null;
    };
    return (canvas) => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true }), w = canvas.width, h = canvas.height, d = ctx.getImageData(0, 0, w, h).data, out = [];
      const bands = [[0, h]], bh = Math.max(48, Math.round(h * 0.2)), st = Math.round(bh * 0.6);   // overlapping thin bands: each one tends to see a single barcode of a stack
      if (h >= bh * 2.5) for (let y = 0; y + bh < h + st && bands.length < 9; y += st) { const a = Math.min(y, h - bh); bands.push([a, a + bh]); }
      bands.forEach(([a, b], n) => { const r = one(d, w, h, a, b, n === 0); if (r) out.push(r); });
      return out;
    };
  }

  // decode(canvas) -> [{ value, format, x, y }] in canvas pixels. engine: 'auto' (default), 'zxing' (force the bundled decoder).
  A.scanDecode = { FORMATS, async create(engine = 'auto') {
    const det = engine === 'zxing' ? false : await nativeDetector();
    if (det) return { name: 'native', decode: async (canvas) => { const found = await det.detect(canvas); return found.map(f => { const c = mid(f.cornerPoints) || { x: f.boundingBox.x + f.boundingBox.width / 2, y: f.boundingBox.y + f.boundingBox.height / 2 }; return { value: f.rawValue, format: f.format, x: c.x, y: c.y }; }); } };
    const Z = await loadZxing(), run = zxingReader(Z);
    return { name: 'zxing', decode: async (canvas) => run(canvas) };
  } };
})();
