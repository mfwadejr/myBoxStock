// SERVICES / mail / theme — email clients can't read CSS variables, so email styling is centralized here and
// a test verifies every value equals the matching token in public/css/tokens.css.
export const EMAIL_THEME = {
  '--color-bg': '#f5f5f7',
  '--color-surface': '#ffffff',
  '--color-text': '#1d1d1f',
  '--color-text-muted': '#6e6e73',
  '--color-text-faint': '#86868b',
  '--color-line': 'rgba(0, 0, 0, 0.08)',
  '--color-primary': '#0071e3',
  '--color-primary-on': '#ffffff',
  '--radius-lg': '18px',
  '--radius-pill': '999px',
  '--font-sans': '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif',
};
const T = EMAIL_THEME, font = T['--font-sans'].replace(/"/g, "'");
export const emailStyles = {
  body: `margin:0;padding:24px 12px;background:${T['--color-bg']};font-family:${font};font-size:15px;line-height:1.5;color:${T['--color-text']}`,
  card: `max-width:520px;margin:0 auto;background:${T['--color-surface']};border-radius:${T['--radius-lg']};padding:32px`,
  header: `text-align:center;margin-bottom:24px`,
  logo: `display:inline-block;width:56px;height:56px;margin:0 0 8px;border:0`, // explicit size in the style: Apple Mail ignores the width/height attributes and shows the file at full size
  brand: `font-weight:600;font-size:18px;color:${T['--color-text']}`,
  title: `font-size:22px;font-weight:600;line-height:1.25;margin:0 0 16px;color:${T['--color-text']}`,
  button: `display:inline-block;background:${T['--color-primary']};color:${T['--color-primary-on']};text-decoration:none;font-weight:600;padding:12px 24px;border-radius:${T['--radius-pill']}`,
  faint: `color:${T['--color-text-faint']}`,
  footer: `max-width:520px;margin:16px auto 0;text-align:center;font-size:12px;color:${T['--color-text-faint']}`,
};
export const LOGO_CID = 'mbs-logo';
