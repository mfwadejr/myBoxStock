// SHARED / qr — renders a QR code as inline SVG using CSS classes only (colors come from tokens via .qr-dark / .qr-light).
(() => {
  UI.qrSvg = (text) => {
    if (typeof qrcode === 'undefined') return '';
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect class="qr-light" width="${n}" height="${n}"/><path class="qr-dark" d="${d}"/></svg>`;
  };
})();
