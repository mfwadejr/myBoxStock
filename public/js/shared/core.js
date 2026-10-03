// SHARED / core — namespace, escaping, formatting, content swap, dynamic CSS values.
// Rule: scripts never write inline styles or set colors/sizes. They toggle classes, or set CSS custom properties (data-pct → --pct).
window.UI = window.UI || {};
(() => {
  UI.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  UI.fmt = {
    bytes(n) { if (n == null) return '—'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < 4) { n /= 1024; i++; } return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`; },
    dur(s) { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; },
    date(t) { return t ? new Date(Number(t)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'; },
    dateTime(t) { return t ? new Date(Number(t)).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }) : '—'; },
    ago(t) { if (!t) return 'never'; const s = (Date.now() - Number(t)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; },
    pct(a, b) { return b ? Math.round(a / b * 100) : 0; },
  };

  // Apply data-pct="42" as the CSS custom property --pct (the stylesheet turns it into a width).
  UI.dynamic = (root) => root.querySelectorAll('[data-pct]').forEach(el => el.style.setProperty('--pct', el.dataset.pct));

  // Replace content with a soft fade/rise (synchronous, so callers can attach listeners straight away).
  UI.swap = (el, html) => { el.innerHTML = html; UI.dynamic(el); el.classList.remove('view'); void el.offsetWidth; el.classList.add('view'); };
})();
